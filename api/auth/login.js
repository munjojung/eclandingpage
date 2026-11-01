import crypto from 'crypto';
import { promisify } from 'util';
import { getDb } from '../_lib/db.js';
const scrypt = promisify(crypto.scrypt);
import { createAdminSession, requireSameOrigin, setSessionCookie } from '../_lib/admin-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const originError = requireSameOrigin(req);
  if (originError) return res.status(403).json({ success: false, error: originError });

  // dev Preview: personal administrator accounts only; no shared-password fallback.
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'dev') {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || email.length > 254 || !password || password.length > 1024) {
        return res.status(400).json({ success: false, error: '관리자 이메일과 비밀번호를 입력하세요.' });
      }
      const sql = getDb();
      const rows = await sql`
        SELECT c.user_id, c.password_hash, u.real_name
        FROM esl_v2.admin_credentials c
        JOIN esl_v2.users u ON u.user_id = c.user_id
        WHERE lower(u.email) = ${email}
          AND u.account_status = 'active'
          AND c.enabled = true
          AND EXISTS (
            SELECT 1 FROM esl_v2.user_roles r
            WHERE r.user_id = u.user_id AND r.role = 'admin' AND r.status = 'approved'
          )
        LIMIT 1
      `;
      // Equal-cost verification for unknown users (avoid trivial account enumeration).
      const dummy = 'scrypt$16384$8$1$00000000000000000000000000000000$' + '00'.repeat(64);
      const stored = rows[0]?.password_hash || dummy;
      const [algorithm, n, r, p, salt, hex] = stored.split('$');
      if (algorithm !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hex)) {
        throw new Error('Invalid password hash format');
      }
      const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
      const ok = crypto.timingSafeEqual(derived, Buffer.from(hex, 'hex'));
      if (!rows.length || !ok) {
        return res.status(401).json({ success: false, error: '관리자 계정 또는 비밀번호가 올바르지 않습니다.' });
      }
      const token = await createAdminSession(rows[0].user_id);
      setSessionCookie(res, token);
      return res.status(200).json({ success: true, user: { user_id: rows[0].user_id, real_name: rows[0].real_name } });
    } catch (error) {
      console.error('Personal admin login failed:', error);
      return res.status(500).json({ success: false, error: '로그인 처리 중 오류가 발생했습니다.' });
    }
  }
  // Existing production login is retained unchanged.
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
