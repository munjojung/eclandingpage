/**
 * Phase 1: intentionally disabled.
 * PDFs are stored only on the administrator's PC in private_pdfs/.
 * A Vercel function cannot read that local folder. Do not re-enable a public URL
 * or phone-number-only download shortcut. Phase 2 should use private object storage
 * plus authenticated, per-file authorization.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Allow', 'GET');
  return res.status(410).json({
    success: false,
    error: '온라인 PDF 다운로드는 현재 비활성화되어 있습니다. PDF는 관리자 PC에만 저장됩니다.'
  });
}
