# Dev DB isolation patch

Based on uploaded eclandingpage-main (7).zip, with deleted legacy api/login.js omitted to match current main.

Copy api/_lib/db.js and the 8 changed API files into the local repository while on dev branch. Do not replace the entire repository blindly.

Production: DATABASE_URL. Preview dev: DEV_DATABASE_URL. All other environments: database access denied. No fallback.

Note: Preview dev still has production Neon integration variables available; code paths not included in this patch or future code may use them. Audit all DB access before exposing sensitive operations.

Check syntax with node --check and git diff. Preview dev has schema only, so legacy data queries may return empty. APP_ORIGIN and existing admin cookie origin rules may need preview-specific configuration. Never copy production credentials into a test environment.
