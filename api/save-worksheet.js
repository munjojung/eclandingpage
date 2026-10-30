// api/save-worksheet.js
import { sql } from '@vercel/postgres'; // 또는 프로젝트에서 사용 중인 Neon DB 연결 방식
import cookie from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405.1).json({ error: 'Method not allowed' });
  }

  try {
    // 1. 관리자 인증 확인 (기존 admin 인증 로직 연동)
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionToken = cookies.session; // 또는 사용 중인 쿠키 이름
    
    // 만약 CLI 로컬 스크립트에서 호출할 경우를 대비해 비밀 키 헤더도 함께 허용하면 편리합니다.
    const adminSecret = req.headers['x-admin-secret'];
    if (!sessionToken && adminSecret !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. 전달받은 워크시트 데이터 추출
    const { topic, targetDate, page1Data, page2Data } = req.body;
    if (!topic || !page1Data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 3. Neon DB에 저장 (예시 SQL)
    await sql`
      INSERT INTO worksheets (topic, target_date, page1_content, page2_content, created_at)
      VALUES (${topic}, ${targetDate}, ${JSON.stringify(page1Data)}, ${JSON.stringify(page2Data)}, NOW())
    `;

    return.status(200).json({ success: true, message: '워크시트가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('Save Worksheet Error:', error);
    return res.status(500).json({ error: error.message });
  }
}