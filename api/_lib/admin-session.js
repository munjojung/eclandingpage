import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

export const COOKIE_NAME = 'esl_admin_session';
const SESSION_HOURS = 12;

export function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function requireSameOrigin(req) {
  const configured = process.env.APP_ORIGIN;
  if (!configured) return '서버의 APP_ORIGIN 환경 변수가 설정되지 않았습니다.';
  const origin = req.headers.origin;
  if (!origin || origin !== configured) return '허용되지 않은 Origin 접근입니다.';
  return null;
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export async function createAdminSession() {
  const sql = getSql();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await sql`
    INSERT INTO esl_admin_sessions_v2 (token_hash, expires_at)
    VALUES (${tokenHash}, CURRENT_TIMESTAMP + INTERVAL '12 hours')
  `;
  return token;
}

export async function verifyAdminSession(req) {
  const token = readCookie(req);
  if (!token || token.length > 200) return false;
  const sql = getSql();
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT token_hash
    FROM esl_admin_sessions_v2
    WHERE token_hash = ${tokenHash}
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function revokeAdminSession(req) {
  const token = readCookie(req);
  if (!token || token.length > 200) return;
  const sql = getSql();
  const tokenHash = hashToken(token);
  await sql`DELETE FROM esl_admin_sessions_v2 WHERE token_hash = ${tokenHash}`;
}
