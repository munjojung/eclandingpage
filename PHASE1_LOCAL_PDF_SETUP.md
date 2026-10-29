# English Community — 1단계: 관리자 PC 로컬 PDF 보관

## 결정된 운영 원칙
- `generator.html`과 `download.html`은 독립된 페이지로 유지합니다.
- 관리자는 기존 `generator.html`에서 학습지를 생성하고 `인쇄 / PDF 저장`으로 PDF를 만듭니다.
- 생성된 PDF를 `private_pdfs/` 폴더에 로컬 보관합니다.
- `local-pdf-library.html`은 PDF 파일을 선택한 로컬 폴더로 복사하고 `manifest.json` 목록을 관리하는 로컬 도구입니다.
- 현재 단계에서는 PDF를 Vercel/Neon에 업로드하지 않으며, 온라인 회원 다운로드를 비활성화합니다.
- `api/download.js`는 의도적으로 HTTP 410을 반환합니다. 이는 PC 로컬 파일이 Vercel에서 보이지 않기 때문입니다.

## 1. PDF 생성
1. 사이트에서 관리자 로그인 후 `generator.html`을 엽니다.
2. 주제를 입력하고 학습지를 생성합니다.
3. `인쇄 / PDF 저장`을 누르고 브라우저 인쇄 대화상자에서 PDF로 저장합니다.
4. PDF를 임시로 원하는 위치(예: Downloads)에 저장합니다.

주의: `generator.html`은 Gemini 콘텐츠 생성을 위해 `/api/generate-worksheet`를 호출하므로, 로컬 `python -m http.server`로 실행하면 API 라우트가 제공되지 않습니다. 기존 Vercel 사이트에서 관리자 로그인 상태로 생성하거나, 별도 로컬 백엔드를 구현해야 합니다.

## 2. PDF를 private_pdfs에 등록
1. Windows에서 `RUN_LOCAL_PDF_LIBRARY.bat`을 실행합니다.
2. Chrome/Edge에서 `http://localhost:8000/local-pdf-library.html`이 열립니다.
3. `① private_pdfs 폴더 선택`을 누르고 프로젝트 안의 `private_pdfs` 폴더를 선택합니다.
4. 제목, 회차, 생성한 PDF 파일을 선택합니다.
5. `③ 로컬 폴더에 등록`을 누릅니다.
6. PDF 파일과 `manifest.json`이 관리자 PC에 저장됩니다.

브라우저가 폴더 접근 권한을 요청하면 읽기/쓰기 권한을 허용해야 합니다. 지원 브라우저는 최신 Chrome/Edge입니다. 이 도구는 파일을 서버로 전송하지 않습니다.

## 3. GitHub/Vercel 보안
- PDF는 `private_pdfs/`에만 둡니다. `public/`에는 넣지 마세요.
- `.gitignore`에서 `/private_pdfs/*`를 무시합니다. 단, 이미 Git이 추적 중인 파일은 `.gitignore`만으로 제거되지 않습니다.
- PDF 또는 `manifest.json`이 과거에 커밋된 적이 있으면 Git 추적에서 제거하고 저장소 기록/접근 권한도 검토하세요.
- 로컬 폴더에 있는 파일은 Vercel에서 읽을 수 없습니다. 따라서 온라인 `download.html`은 현재 안내 화면만 보여줍니다.
- 현재 단계에서 전화번호만 입력받아 다운로드하는 기능은 사용하지 않습니다. 전화번호 입력만으로 본인 인증을 보장할 수 없기 때문입니다.

## 4. 현재 단계의 한계
- `private_pdfs/`는 관리자 PC 로컬 보관함입니다. 회원이 인터넷으로 PDF를 다운로드하는 기능은 제공하지 않습니다.
- `manifest.json`도 로컬 파일입니다. 온라인 사이트가 이를 자동으로 읽지 않습니다.
- `generator.html`의 인쇄 대화상자에서 생성된 PDF는 관리자가 저장한 뒤 로컬 보관 도구로 등록합니다. 브라우저가 인쇄 결과를 지정 폴더에 자동 저장하는 것은 지원하지 않습니다.

## 5. 2단계: 비공개 클라우드로 확장할 때
1. 비공개 파일 저장소(Vercel Blob private access 방식 또는 Cloudflare R2 private bucket 등)를 선택합니다.
2. 관리자 전용 업로드 API를 추가합니다. API는 관리자 세션을 검증하고 PDF 서명/크기/파일명 등을 검사합니다.
3. Neon DB에 `esl_pdfs` 같은 테이블을 만들고 제목, 회차, 저장소 키, 공개 상태, 등록일을 저장합니다. 비공개 원본 URL은 공개 응답에 넣지 않습니다.
4. 회원 인증을 구현합니다. 전화번호 문자열만 입력하는 것은 본인 인증이 아닙니다. 기존 인증 세션이나 SMS OTP 등을 사용합니다.
5. `download.html`이 회원용 목록 API를 호출해 메타데이터만 가져옵니다.
6. 다운로드 API는 매 요청마다 회원과 해당 PDF에 대한 권한을 확인한 뒤 파일을 스트리밍하거나 짧은 만료 시간의 서명 URL을 발급합니다.
7. 로컬 `manifest.json`의 메타데이터를 마이그레이션할 수 있게 설계하되, 실제 파일은 업로드 후 검증이 끝나기 전까지 로컬에 유지합니다.

## 테스트/검증 상태
- 정적 HTML/JavaScript 구문 검사를 수행합니다.
- 실제 Vercel, Neon, Gemini, PDF 인쇄 및 브라우저 폴더 권한은 배포 환경에서 별도 확인해야 합니다.
