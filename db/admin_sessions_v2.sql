-- Run once in the Neon SQL Editor before deploying the session-auth update.
-- Only a SHA-256 hash of the random session token is stored.
CREATE TABLE IF NOT EXISTS esl_admin_sessions_v2 (
  token_hash CHAR(64) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_esl_admin_sessions_v2_expires_at
  ON esl_admin_sessions_v2 (expires_at);

-- Optional cleanup for expired sessions:
-- DELETE FROM esl_admin_sessions_v2 WHERE expires_at <= CURRENT_TIMESTAMP;
