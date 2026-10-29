import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. 헤더 또는 쿠키에서 토큰 추출
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
    return res.status(401).json({ success: false, authenticated: false, error: '인증 토큰이 없습니다.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const sessions = await sql`
      SELECT token FROM esl_sessions 
      WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP 
      LIMIT 1;
    `;

    if (sessions.length === 0) {
      return res.status(401).json({ success: false, authenticated: false, error: '세션이 만료되었습니다.' });
    }

    return res.status(200).json({ success: true, authenticated: true });

  } catch (error) {
    console.error('Auth Me Error:', error);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
}