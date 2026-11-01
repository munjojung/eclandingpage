
import { createHash } from 'node:crypto';
import { getDb } from './_lib/db.js';
import { getAdminIdentity } from './_lib/admin-session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');

  // 1. dev 브랜치의 Vercel Preview에서만 실행
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'dev'
  ) {
    return res.status(404).json({ error: 'Not found' });
  }

  // 2. 읽기 전용 GET 요청만 허용
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    // 3. 현재 세션의 관리자 인증 및 권한 확인
    const actor = await getAdminIdentity(req);

    if (!actor || !Number.isSafeInteger(actor.user_id)) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    // 4. Preview 전용 DB 연결 문자열 확인
    const connectionString = process.env.DEV_DATABASE_URL;

    if (!connectionString) {
      throw new Error('DEV_DATABASE_URL missing');
    }

    const parsed = new URL(connectionString);

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('Invalid DB URL scheme');
    }

    // DB 호스트 원문은 반환하지 않고 SHA-256 지문만 반환
    const hostname = parsed.hostname.toLowerCase();

    const hostFingerprint = createHash('sha256')
      .update(hostname)
      .digest('hex');

    // 5. 실제 연결된 DB와 관리자 역할 상태 조회
    const sql = getDb();

    const rows = await sql`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        (
          SELECT r.status
          FROM esl_v2.user_roles r
          WHERE r.user_id = ${actor.user_id}
            AND r.role = 'admin'
          ORDER BY
            CASE
              WHEN r.status = 'approved' THEN 0
              ELSE 1
            END
          LIMIT 1
        ) AS admin_role_status
    `;

    // 6. 민감한 연결 정보 없이 진단 결과 반환
    return res.status(200).json({
      environment: 'preview',
      git_branch: 'dev',
      database_variable: 'DEV_DATABASE_URL',
      db_host_sha256: hostFingerprint,
      database_name: rows[0]?.database_name ?? null,
      database_user: rows[0]?.database_user ?? null,
      actor_user_id: actor.user_id,
      admin_role_status: rows[0]?.admin_role_status ?? null
    });

  } catch (error) {
    console.error(
      '6A2 diagnostic failed:',
      error?.message || 'unknown'
    );

    return res.status(503).json({
      error: 'Diagnostic unavailable'
    });
  }
}
