import { getAdminIdentity } from '../_lib/admin-session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, authenticated: false, error: 'Method Not Allowed' });
  }
  try {
    const identity = await getAdminIdentity(req);
    if (!identity) {
      return res.status(401).json({ success: false, authenticated: false, error: '인증되지 않았거나 세션이 만료되었습니다.' });
    }
    return res.status(200).json({ success: true, authenticated: true, user: identity });
  } catch (error) {
    console.error('Auth Me Error:', error);
    return res.status(500).json({ success: false, authenticated: false, error: '서버 오류가 발생했습니다.' });
  }
}
