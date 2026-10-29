import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { password } = req.body;
  const adminSecret = process.env.ADMIN_PASSWORD;

  if (!adminSecret || adminSecret.length < 16) {
    return res.status(503).json({ success: false, error: '관리자 인증 설정이 올바르지 않습니다.' });
  }

  if (!password || password !== adminSecret) {
    return res.status(401).json({ success: false, error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // 세션 테이블 생성 (최초 1회 자동 생성)
    await sql`
      CREATE TABLE IF NOT EXISTS esl_sessions (
        token VARCHAR(64) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '12 hours'
      );
    `;

    // 무작위 세션 토큰 생성
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // DB에 세션 저장 (12시간 유효)
    await sql`
      INSERT INTO esl_sessions (token, expires_at)
      VALUES (${sessionToken}, CURRENT_TIMESTAMP + INTERVAL '12 hours');
    `;

    // HttpOnly 쿠키로 세션 토큰 전달
    res.setHeader(
      'Set-Cookie',
      `admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
    );

    return res.status(200).json({
      success: true,
      message: '관리자 로그인 성공',
      token: sessionToken // 프론트엔드 헤더 fallback용
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, error: '서버 내부 오류가 발생했습니다.' });
  }
}