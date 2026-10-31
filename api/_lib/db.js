import { neon } from '@neondatabase/serverless';

// Fail closed: never fall back to production DB in Preview.
export function getDb() {
  const environment = process.env.VERCEL_ENV;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  let url;
  if (environment === 'production') {
    url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
  } else if (environment === 'preview' && branch === 'dev') {
    url = process.env.DEV_DATABASE_URL;
    if (!url) throw new Error('DEV_DATABASE_URL is not configured');
  } else {
    throw new Error('Database access disabled for this environment');
  }
  return neon(url);
}
