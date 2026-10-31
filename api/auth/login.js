import crypto from 'crypto';
import { createAdminSession, requireSameOrigin, setSessionCookie } from '../_lib/admin-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const originError = requireSameOrigin(req);
  if (originError) return res.status(403).json({ success: false, error: originError });

  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret || Buffer.byteLength(adminSecret, 'utf8') < 16) {
    return res.status(503).json({ success: false, error: '관리자 인증 설정이 올바르지 않습니다.' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const supplied = Buffer.from(password, 'utf8');
  const expected = Buffer.from(adminSecret, 'utf8');
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

  if (!matches) return res.status(401).json({ success: false, error: '관리자 비밀번호가 일치하지 않습니다.' });

  try {
    const token = await createAdminSession();
    setSessionCookie(res, token);
    return res.status(200).json({ success: true, message: '로그인 성공' });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
}
