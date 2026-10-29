import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

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

  if (token) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      await sql`DELETE FROM esl_sessions WHERE token = ${token};`;
    } catch (error) {
      console.error('Logout DB Error:', error);
    }
  }

  // 쿠키 만료 처리
  res.setHeader(
    'Set-Cookie',
    'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  );

  return res.status(200).json({ success: true, message: '로그아웃 되었습니다.' });
}