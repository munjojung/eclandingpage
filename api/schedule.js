import { neon } from '@neondatabase/serverless';

const TIME_ZONE = 'Asia/Seoul';
const REGISTRATION_DEADLINE_HOUR = 17;

// 서버 실행 위치와 관계없이 한국 시간(Asia/Seoul) 기준 날짜/시간을 구합니다.
function getKoreaDateTimeParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 한국 시간 기준 내일 날짜를 계산합니다.
function getTomorrowInKorea() {
  const { year, month, day } = getKoreaDateTimeParts();

  // 월말과 연말에도 정확하게 날짜가 넘어가도록 UTC 날짜 계산을 사용합니다.
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));

  return formatDate(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate()
  );
}

// YYYY-MM-DD 형식과 실제 달력 날짜가 올바른지 확인합니다.
function isValidCalendarDate(dateString) {
  if (
    typeof dateString !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return false;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

// 전화번호에서 하이픈, 공백, 괄호 등 숫자가 아닌 문자를 제거합니다.
function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  // POST 요청만 허용합니다.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      success: false,
      error: '지원하지 않는 요청 방식입니다.',
    });
  }

  const { name, phone, target_date, time_slot } = req.body ?? {};

  const normalizedName =
    typeof name === 'string' ? name.trim() : '';

  const normalizedPhone = normalizePhone(phone);

  const normalizedDate =
    typeof target_date === 'string' ? target_date.trim() : '';

  const normalizedTimeSlot =
    typeof time_slot === 'string' ? time_slot.trim() : '';

  // 필수 입력값을 확인합니다.
  if (
    !normalizedName ||
    !normalizedPhone ||
    !normalizedDate ||
    !normalizedTimeSlot
  ) {
    return res.status(400).json({
      success: false,
      error: '이름, 전화번호, 날짜, 시간대를 모두 입력해 주세요.',
    });
  }

  // 전화번호는 국가번호를 포함해 숫자 8~15자리만 허용합니다.
  if (
    normalizedPhone.length < 8 ||
    normalizedPhone.length > 15
  ) {
    return res.status(400).json({
      success: false,
      error: '전화번호를 확인해 주세요. 국가번호를 포함해 숫자 8~15자리로 입력해 주세요.',
    });
  }

  // 날짜 형식과 실제 존재하는 날짜인지 확인합니다.
  if (!isValidCalendarDate(normalizedDate)) {
    return res.status(400).json({
      success: false,
      error: '날짜 형식이 올바르지 않습니다. 날짜를 다시 선택해 주세요.',
    });
  }

  // 한국 시간 기준 오후 5시 마감 여부를 확인합니다.
  const koreaNow = getKoreaDateTimeParts();

  const currentKoreaTime =
    koreaNow.hour * 60 + koreaNow.minute;

  const deadline = REGISTRATION_DEADLINE_HOUR * 60;

  // 오후 5시부터 신규 등록 및 일정 변경을 모두 차단합니다.
  if (currentKoreaTime >= deadline) {
    return res.status(400).json({
      success: false,
      error: '밋업 일정 등록은 한국 시간 기준 매일 오후 5시까지 가능합니다.',
    });
  }

  // 등록 대상은 한국 시간 기준 내일 날짜만 허용합니다.
  const tomorrow = getTomorrowInKorea();

  if (normalizedDate !== tomorrow) {
    return res.status(400).json({
      success: false,
      error: `밋업 일정은 내일 날짜(${tomorrow})만 등록할 수 있습니다.`,
    });
  }

  // 데이터베이스 연결 설정을 확인합니다.
  if (!process.env.DATABASE_URL) {
    console.error(
      'Schedule Register Error: DATABASE_URL is not configured.'
    );

    return res.status(500).json({
      success: false,
      error: '서버 데이터베이스 설정을 확인해 주세요.',
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // 밋업 일정 테이블이 없으면 생성합니다.
    await sql`
      CREATE TABLE IF NOT EXISTS esl_schedules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        target_date DATE NOT NULL,
        time_slot VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_phone_date UNIQUE (phone, target_date)
      );
    `;

    // 기존 데이터에 하이픈이나 공백이 포함되어 있어도
    // 동일한 전화번호로 인식합니다.
    const existingRows = await sql`
      SELECT id
      FROM esl_schedules
      WHERE target_date = ${normalizedDate}::date
        AND regexp_replace(phone, '[^0-9]', '', 'g') = ${normalizedPhone}
      ORDER BY id ASC
      LIMIT 2;
    `;

    // 동일 전화번호의 기존 데이터가 여러 건이면
    // 임의로 수정하지 않고 관리자 확인을 요청합니다.
    if (existingRows.length > 1) {
      return res.status(409).json({
        success: false,
        error: '같은 전화번호로 된 기존 일정 데이터가 여러 건 있습니다. 관리자에게 확인을 요청해 주세요.',
      });
    }

    if (existingRows.length === 1) {
      // 기존 신청이 있으면 해당 신청을 수정합니다.
      await sql`
        UPDATE esl_schedules
        SET name = ${normalizedName},
            phone = ${normalizedPhone},
            time_slot = ${normalizedTimeSlot},
            created_at = CURRENT_TIMESTAMP
        WHERE id = ${existingRows[0].id};
      `;
    } else {
      // 신규 신청은 숫자만 남긴 전화번호로 저장합니다.
      await sql`
        INSERT INTO esl_schedules (
          name,
          phone,
          target_date,
          time_slot
        )
        VALUES (
          ${normalizedName},
          ${normalizedPhone},
          ${normalizedDate},
          ${normalizedTimeSlot}
        )
        ON CONFLICT (phone, target_date)
        DO UPDATE SET
          name = EXCLUDED.name,
          time_slot = EXCLUDED.time_slot,
          created_at = CURRENT_TIMESTAMP;
      `;
    }

    return res.status(200).json({
      success: true,
      message: '참여 일정이 등록(수정)되었습니다. 등록 마감은 한국 시간 기준 오후 5시이며, 팀 매칭은 오후 5시 30분입니다.',
    });

  } catch (error) {
    console.error('Schedule Register Error:', error);

    return res.status(500).json({
      success: false,
      error: '일정 등록 중 서버 오류가 발생했습니다.',
    });
  }
}