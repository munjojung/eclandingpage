import { neon } from '@neondatabase/serverless';

/**
 * 요청(req)으로부터 세션 토큰을 추출하고 데이터베이스에서 유효성을 검증합니다.
 * @param {import('http').IncomingMessage} req 
 * @returns {Promise<{isValid: boolean, token?: string, error?: string}>}
 */
export async function verifyAdminSession(req) {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // 헤더에 토큰이 없다면 쿠키에서 'admin_session' 탐색
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
    return { isValid: false, error: '인증 토큰이 없습니다.' };
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const sessions = await sql`
      SELECT token FROM esl_sessions 
      WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP 
      LIMIT 1;
    `;

    if (sessions.length === 0) {
      return { isValid: false, error: '세션이 만료되었거나 유효하지 않습니다.' };
    }

    return { isValid: true, token };
  } catch (error) {
    console.error('Session Verification Error:', error);
    return { isValid: false, error: '세션 검증 중 서버 오류가 발생했습니다.' };
  }
}