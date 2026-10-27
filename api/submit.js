import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vercel 환경 변수에 등록된 DATABASE_URL 사용
    const sql = neon(process.env.DATABASE_URL);

    // 프론트엔드에서 보낸 데이터 추출
    const {
      name,
      phone,
      role,
      level,
      preferred_time,
      location,
      referrer,
      funnel_path
    } = req.body;

    // 필수값 검증
    if (!name || !phone) {
      return res.status(400).json({ error: '이름과 연락처는 필수 입력 항목입니다.' });
    }

    // Neon PostgreSQL 데이터베이스에 데이터 삽입
    const result = await sql`
      INSERT INTO esl_inquiries (
        name, phone, role, level, preferred_time, location, referrer, funnel_path
      ) VALUES (
        ${name}, ${phone}, ${role || null}, ${level || null}, ${preferred_time || null}, ${location || null}, ${referrer || null}, ${funnel_path || '웹폼'}
      )
      RETURNING id, created_at;
    `;

    return res.status(200).json({
      success: true,
      message: '문의가 성공적으로 저장되었습니다.',
      data: result[0]
    });

  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
}