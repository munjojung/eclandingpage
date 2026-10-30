// api/save-worksheet.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 어드민 시크릿 키 검증
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin Secret' });
  }

  try {
    const { topic, targetDate, page1Data, page2Data } = req.body;

    if (!topic || !targetDate || !page1Data || !page2Data) {
      return res.status(400).json({ error: 'Missing required fields in request body' });
    }

    // Neon DB 연결
    const sql = neon(process.env.DATABASE_URL);

    // DB에 데이터 저장 (테이블 구조에 맞게 쿼리 작성)
    // 예시: worksheets 테이블에 저장하는 경우
    await sql`
      INSERT INTO worksheets (topic, target_date, page1_data, page2_data, created_at)
      VALUES (${topic}, ${targetDate}, ${JSON.stringify(page1Data)}, ${JSON.stringify(page2Data)}, NOW())
    `;

    return res.status(200).json({ success: true, message: 'Successfully saved to Neon DB' });

  } catch (error) {
    console.error('Database save error:', error);
    return res.status(500).json({ error: error.message });
  }
}