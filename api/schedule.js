import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, phone, target_date, time_slot } = req.body;
  if (!name || !phone || !target_date || !time_slot) {
    return res.status(400).json({ error: '모든 항목을 올바르게 입력해 주세요.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // 1. 테이블 생성 시 (phone, target_date) 조합에 UNIQUE 제약 조건 추가
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

    // 2. UPSERT 처리: 동일한 phone과 target_date가 이미 존재하면 UPDATE, 없으면 INSERT
    await sql`
      INSERT INTO esl_schedules (name, phone, target_date, time_slot)
      VALUES (${name.trim()}, ${phone.trim()}, ${target_date}, ${time_slot})
      ON CONFLICT (phone, target_date) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        time_slot = EXCLUDED.time_slot,
        created_at = CURRENT_TIMESTAMP;
    `;

    return res.status(200).json({ 
      success: true, 
      message: '참여 일정이 성공적으로 등록(수정)되었습니다! (매칭 시간: 당일 17:30)' 
    });

  } catch (error) {
    console.error('Schedule Register Error:', error);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다: ' + error.message });
  }
}