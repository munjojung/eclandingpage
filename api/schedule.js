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

    // 테이블 자동 생성 보장
    await sql`
      CREATE TABLE IF NOT EXISTS esl_schedules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        target_date DATE NOT NULL,
        time_slot VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 일정 데이터 저장
    await sql`
      INSERT INTO esl_schedules (name, phone, target_date, time_slot)
      VALUES (${name.trim()}, ${phone.trim()}, ${target_date}, ${time_slot});
    `;

    return res.status(200).json({ 
      success: true, 
      message: '참여 일정이 성공적으로 등록되었습니다! (매칭 시간: 당일 17:30)' 
    });

  } catch (error) {
    console.error('Schedule Register Error:', error);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다: ' + error.message });
  }
}