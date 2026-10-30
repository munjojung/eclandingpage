// api/get-worksheets.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // 📌 worksheets 테이블에서 페이지 데이터까지 포함하여 최근 30개 조회
    const worksheets = await sql`
      SELECT id, topic, target_date, page1_data, page2_data, created_at 
      FROM worksheets 
      ORDER BY id DESC 
      LIMIT 30;
    `;

    return res.status(200).json({ success: true, data: worksheets });
  } catch (error) {
    console.error('Get Worksheets Error:', error);
    return res.status(500).json({ success: false, error: '학습지 목록을 불러오는 중 오류가 발생했습니다.' });
  }
}