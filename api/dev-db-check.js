
import { getDb } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'dev'
  ) {
    return res.status(403).json({
      success: false,
      error: 'Development preview only'
    });
  }

  try {
    const sql = getDb();

    const rows = await sql`
      SELECT environment_name
      FROM esl_environment_check
      WHERE id = 1
    `;

    const verified =
      rows.length === 1 &&
      rows[0].environment_name === 'NEON_DEV_VERIFIED';

    return res.status(verified ? 200 : 503).json({
      success: verified,
      environment: 'preview',
      branch: 'dev',
      database_marker: verified
        ? 'NEON_DEV_VERIFIED'
        : 'MISMATCH'
    });
  } catch (error) {
    console.error('Dev DB verification failed:', error);

    return res.status(503).json({
      success: false,
      error: 'Database verification failed'
    });
  }
}
