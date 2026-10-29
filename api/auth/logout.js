import { clearSessionCookie, requireSameOrigin, revokeAdminSession } from '../_lib/admin-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  const originError = requireSameOrigin(req);
  if (originError) return res.status(403).json({ success: false, error: originError });

  try {
    await revokeAdminSession(req);
    clearSessionCookie(res);
    return res.status(200).json({ success: true, message: '로그아웃 되었습니다.' });
  } catch (error) {
    console.error('Logout Error:', error);
    return res.status(500).json({ success: false, error: '로그아웃 처리 중 서버 오류가 발생했습니다.' });
  }
}
