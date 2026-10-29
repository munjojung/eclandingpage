import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // 1. CORS / APP_ORIGIN 검증 (잘못된 Origin 요청은 403 차단)
  const origin = req.headers.origin;
  const appOrigin = process.env.APP_ORIGIN;
  
  if (req.method !== 'GET' && appOrigin && origin && origin !== appOrigin) {
    return res.status(403).json({ success: false, error: '허용되지 않은 Origin 접근입니다.' });
  }

  // 2. 환경 변수 기반 관리자 설정 확인
  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret || adminSecret.length < 16) {
    return res.status(503).json({ success: false, error: '관리자 인증 설정이 올바르지 않습니다.' });
  }

  // 3. 인증 토큰 추출 (Authorization 헤더 또는 쿠키에서 동시 탐색)
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === 'admin_session') {
        token = val;
        break;
      }
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: '인증 토큰이 없습니다.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // 4. 세션 유효성 검증
    const sessions = await sql`
      SELECT token FROM esl_sessions 
      WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP 
      LIMIT 1;
    `;

    if (sessions.length === 0) {
      return res.status(401).json({ success: false, error: '세션이 만료되었거나 유효하지 않습니다.' });
    }

    // --- 5. 기존 관리자 API 비즈니스 로직 (GET, PUT, DELETE, POST) ---
    if (req.method === 'GET') {
      const type = req.query.type;
      const targetDate = req.query.date;

      if (type === 'meetups') {
        let meetups = targetDate 
          ? await sql`SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members, created_at FROM esl_meetup_groups WHERE date = ${targetDate}::date ORDER BY group_no ASC;`
          : await sql`SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members, created_at FROM esl_meetup_groups ORDER BY date DESC, group_no ASC;`;
        
        const oldMeetups = await sql`SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members FROM esl_meetup_groups WHERE date < CURRENT_DATE - INTERVAL '70 days' ORDER BY date ASC;`;
        return res.status(200).json({ success: true, data: meetups, archived_candidates: oldMeetups });
      } else if (type === 'schedules') {
        let schedules = targetDate
          ? await sql`SELECT id, name, phone, TO_CHAR(target_date, 'YYYY-MM-DD') as target_date, time_slot, created_at FROM esl_schedules WHERE target_date = ${targetDate}::date ORDER BY target_date DESC, id DESC;`
          : await sql`SELECT id, name, phone, TO_CHAR(target_date, 'YYYY-MM-DD') as target_date, time_slot, created_at FROM esl_schedules ORDER BY target_date DESC, id DESC;`;
        return res.status(200).json({ success: true, data: schedules });
      } else {
        const inquiries = await sql`SELECT * FROM esl_inquiries ORDER BY id DESC;`;
        return res.status(200).json({ success: true, data: inquiries });
      }
    }

    if (req.method === 'PUT') {
      const { target, id, name, phone, role, level, preferred_time, location, referrer, facilitator, members, target_date, time_slot } = req.body;
      if (target === 'schedule') {
        await sql`UPDATE esl_schedules SET name = ${name}, phone = ${phone}, target_date = ${target_date}, time_slot = ${time_slot} WHERE id = ${id};`;
      } else if (target === 'meetup') {
        await sql`UPDATE esl_meetup_groups SET facilitator = ${facilitator}, members = ${members} WHERE id = ${id};`;
      } else {
        await sql`UPDATE esl_inquiries SET name = ${name}, phone = ${phone}, role = ${role}, level = ${level}, preferred_time = ${preferred_time}, location = ${location}, referrer = ${referrer} WHERE id = ${id};`;
      }
      return res.status(200).json({ success: true, message: '수정 완료' });
    }

    if (req.method === 'DELETE') {
      const { id, target, archive_old } = req.body;
      if (target === 'schedule') {
        await sql`DELETE FROM esl_schedules WHERE id = ${id};`;
        return res.status(200).json({ success: true, message: '일정 삭제 완료' });
      }
      if (archive_old) {
        await sql`DELETE FROM esl_meetup_groups WHERE date < CURRENT_DATE - INTERVAL '70 days';`;
        return res.status(200).json({ success: true, message: '정리 완료' });
      }
      await sql`DELETE FROM esl_inquiries WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: '삭제 완료' });
    }

    if (req.method === 'POST') {
      const { items } = req.body;
      if (Array.isArray(items)) {
        for (const item of items) {
          await sql`INSERT INTO esl_inquiries (name, phone, role, level, preferred_time, location, referrer) VALUES (${item.name}, ${item.phone}, ${item.role}, ${item.level}, ${item.preferred_time}, ${item.location}, ${item.referrer});`;
        }
      }
      return res.status(200).json({ success: true, message: '일괄 등록 완료' });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE, POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
}