// api/delete-worksheet.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    res.setHeader('Allow', 'DELETE, POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { id, file_name } = req.body;
    
    // 📌 첨부된 Vercel 환경 변수 이미지에 맞춰 POSTGRES_URL_NON_POOLING 사용
    const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
    
    if (!connectionString) {
      return res.status(500).json({ success: false, error: 'Vercel 환경 변수에 POSTGRES_URL_NON_POOLING이 설정되어 있지 않습니다.' });
    }

    const sql = neon(connectionString);

    if (!id && !file_name) {
      return res.status(400).json({ success: false, error: '삭제할 항목의 ID 또는 파일명이 전달되지 않았습니다.' });
    }

    // ID 우선, 없으면 file_name 기준으로 DB에서 삭제
    if (id && !isNaN(Number(id))) {
      await sql`DELETE FROM worksheets WHERE id = ${Number(id)}`;
    } else if (file_name) {
      await sql`DELETE FROM worksheets WHERE file_name = ${file_name}`;
    }

    return res.status(200).json({ success: true, message: 'DB 항목이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete Worksheet Error:', error);
    return res.status(500).json({ success: false, error: 'DB 항목 삭제 중 오류가 발생했습니다.' });
  }
}