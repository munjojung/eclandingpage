# English Community — Gemini API key protection + session auth

## What changed
- Removed the Gemini API key input modal and all `gemini_api_key` localStorage usage from `generator.html`.
- Browser worksheet generation now calls `/api/generate-worksheet` on the same origin.
- Gemini API requests are made by the server using `GEMINI_API_KEY` in a request header, not a URL query string.
- Worksheet generation requires an authenticated admin session.
- Admin login now sets an HttpOnly session cookie and does not return the token in JSON.
- Session tokens are random and only their SHA-256 hashes are stored in `esl_admin_sessions_v2`.
- `admin.html` now uses cookie-based login/logout and checks `/api/auth/me`.
- Existing worksheet history remains in localStorage; it stores worksheet content, not the API key.

## Before deploying
1. In Neon SQL Editor, run `db/admin_sessions_v2.sql` once.
2. In Vercel Environment Variables, set:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD` (at least 16 UTF-8 bytes; use a strong unique password)
   - `APP_ORIGIN` (exact origin, e.g. `https://your-project.vercel.app`, no path or trailing slash)
   - `GEMINI_API_KEY`
   - Optional: `GEMINI_MODEL` (defaults to `gemini-2.5-flash`)
3. Redeploy the project.
4. Open `/admin.html`, sign in, then open `/generator.html` in the same browser to generate a worksheet.

## Validation
- Run `RUN_SECURITY_TEST.bat` against the deployed site.
- Verify that `/api/generate-worksheet` returns 401 in a private/incognito window before login.
- After login, generate a worksheet and confirm it is saved in the existing local history.
- Inspect browser DevTools Network: the Gemini API key must never appear in browser requests or localStorage.
- Check Vercel Function Logs for server-side errors. Do not log the API key or session cookie.

## Important notes
- This archive is based on the uploaded `eclandingpage-main (mod3).zip`. Its current source files were internally inconsistent: login returned a token in JSON, while the test expected a different cookie name; the generator still used a browser-stored key; and the worksheet endpoint accepted only a Bearer token. These files have been aligned in this patch.
- Test against a staging deployment first if this project contains real member data.
- Rate limiting for login and worksheet generation is a separate follow-up hardening task.
