
import { createHash } from 'node:crypto';
import { getAdminIdentity } from '../_lib/admin-session.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');

  // GET 요청만 허용
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      authenticated: false,
      error: 'Method Not Allowed'
    });
  }

  const diagnostic = req.query.diag === '6a2';

  const isDevPreview =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === 'dev';

  // 진단 기능은 dev Preview 전용
  if (diagnostic && !isDevPreview) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  try {
    // 기존 관리자 세션 및 권한 검증
    const identity = await getAdminIdentity(req);

    if (!identity) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: '인증되지 않았거나 세션이 만료되었습니다.'
      });
    }

    // 일반 요청: 기존 응답 구조 유지
    if (!diagnostic) {
      return res.status(200).json({
        success: true,
        authenticated: true,
        user: identity
      });
    }

    // ===== Stage 6A-2 진단 기능 =====

    const userId = Number(identity.user_id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: 'Personal admin identity required'
      });
    }

    const connectionString = process.env.DEV_DATABASE_URL;

    if (!connectionString) {
      throw new Error('DEV_DATABASE_URL missing');
    }

    const parsed = new URL(connectionString);

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('Invalid database URL protocol');
    }

    // 비밀번호와 전체 연결 문자열은 반환하지 않음
    const hostname = parsed.hostname.toLowerCase();

    const hostFingerprint = createHash('sha256')
      .update(hostname)
      .digest('hex');

    const sql = getDb();

    // 읽기 전용 진단 쿼리
    const rows = await sql`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        (
          SELECT r.status
          FROM esl_v2.user_roles r
          WHERE r.user_id = ${userId}
            AND r.role = 'admin'
          ORDER BY
            CASE
              WHEN r.status = 'approved' THEN 0
              ELSE 1
            END
          LIMIT 1
        ) AS admin_role_status
    `;

    const row = rows[0] || {};

    return res.status(200).json({
      success: true,
      authenticated: true,
      diagnostic: '6A-2',
      environment: process.env.VERCEL_ENV,
      git_branch: process.env.VERCEL_GIT_COMMIT_REF,
      database_variable: 'DEV_DATABASE_URL',
      db_host_sha256: hostFingerprint,
      database_name: row.database_name ?? null,
      database_user: row.database_user ?? null,
      actor_user_id: userId,
      admin_role_status: row.admin_role_status ?? null
    });

  } catch (error) {
    console.error(
      'Auth Me / 6A-2 Error:',
      error?.name || 'UnknownError'
    );

    return res.status(500).json({
      success: false,
      authenticated: false,
      error: '서버 오류가 발생했습니다.'
    });
  }
}
