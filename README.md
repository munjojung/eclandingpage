# English Community

English Community website and worksheet generator.

## PDF workflow — Phase 1 (current)
- Generate worksheets in `generator.html` (Gemini generation uses the deployed `/api/generate-worksheet` API and administrator session).
- Save the worksheet as a PDF using the browser's **인쇄 / PDF 저장** button.
- Use `RUN_LOCAL_PDF_LIBRARY.bat` and `local-pdf-library.html` to copy the PDF into the administrator PC's `private_pdfs/` folder and maintain a local `manifest.json`.
- The PDF files and manifest remain on the administrator PC. They are ignored by Git.
- `download.html` is an informational page in Phase 1. Online member downloads are deliberately disabled because Vercel cannot access the administrator PC's local folder.

Read [`PHASE1_LOCAL_PDF_SETUP.md`](PHASE1_LOCAL_PDF_SETUP.md) for setup, limitations, and the Phase 2 private-cloud migration plan.

## Important
Do not put member-only PDFs under `public/` or commit them to GitHub. The folder name `private_pdfs` does not itself enforce access control; safety here comes from keeping the files local and outside the deployed website.
