
import crypto from 'crypto';
import { getDb } from './db.js';

export const COOKIE_NAME = 'esl_admin_session';
const SESSION_HOURS = 12;

// 쿠키에서 관리자 세션 토큰 읽기
export function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers.cookie || '';

  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;

    const key = part.slice(0, idx).trim();

    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }

  return null;
}

// 요청 Origin 검사
// 기존 보안 검사 방식은 유지하고 한글 오류 메시지만 수정
export function requireSameOrigin(req) {
  const configured = process.env.APP_ORIGIN;

  if (!configured) {
    return '서버의 APP_ORIGIN 환경 변수가 설정되지 않았습니다.';
  }

  const origin = req.headers.origin;

  if (!origin || origin !== configured) {
    return '허용되지 않은 Origin 접근입니다.';
  }

  return null;
}

// 관리자 세션 쿠키 생성
export function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === 'production' ? '; Secure' : '';

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`
  );
}

// 관리자 세션 쿠키 삭제
export function clearSessionCookie(res) {
  const secure =
    process.env.NODE_ENV === 'production' ? '; Secure' : '';

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
  );
}

// 세션 토큰 SHA-256 해시 생성
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// 공통 DB 연결
function getSql() {
  return getDb();
}

// 관리자 세션 생성
export async function createAdminSession(userId = null) {
  const sql = getSql();

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);

  if (process.env.VERCEL_ENV === 'production' && userId === null) {
    // Preserve the existing production schema until its own migration.
    await sql`
      INSERT INTO esl_admin_sessions_v2 (token_hash, expires_at)
      VALUES (${tokenHash}, CURRENT_TIMESTAMP + INTERVAL '12 hours')
    `;
  } else {
    if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
      throw new Error('Personal admin session requires a valid user ID');
    }
    await sql`
      INSERT INTO esl_admin_sessions_v2 (token_hash, expires_at, user_id)
      VALUES (${tokenHash}, CURRENT_TIMESTAMP + INTERVAL '12 hours', ${userId}::bigint)
    `;
  }

  return token;
}

// 관리자 세션 인증 확인
export async function getAdminIdentity(req) {
  const token = readCookie(req);

  if (!token || token.length > 200) {
    return null;
  }

  const sql = getSql();
  const tokenHash = hashToken(token);

  const rows = await sql`
    SELECT s.user_id, u.real_name
    FROM esl_admin_sessions_v2 s
    LEFT JOIN esl_v2.users u ON u.user_id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > CURRENT_TIMESTAMP
      AND (
        (s.user_id IS NULL AND ${process.env.VERCEL_ENV === 'production'}::boolean)
        OR (
          u.account_status = 'active'
          AND EXISTS (
            SELECT 1 FROM esl_v2.user_roles r
            WHERE r.user_id = s.user_id
              AND r.role = 'admin' AND r.status = 'approved'
          )
        )
      )
    LIMIT 1
  `;

  return rows.length ? { user_id: rows[0].user_id === null ? null : Number(rows[0].user_id), real_name: rows[0].real_name || null } : null;
}

// 관리자 세션 폐기 (로그아웃)
export async function revokeAdminSession(req) {
  const token = readCookie(req);

  if (!token || token.length > 200) {
    return;
  }

  const sql = getSql();
  const tokenHash = hashToken(token);

  await sql`
    DELETE FROM esl_admin_sessions_v2
    WHERE token_hash = ${tokenHash}
  `;
}

export async function verifyAdminSession(req) {
  return Boolean(await getAdminIdentity(req));
}
