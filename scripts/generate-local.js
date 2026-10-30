// scripts/generate-local.js
import fs from 'fs';
import path from 'path';

// 📌 .env 파일에 정의된 환경 변수들을 가져옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; 

const VERCEL_SAVE_API_URL = "https://eclandingpage-kappa.vercel.app/api/save-worksheet";

async function runLocalGeneration() {
  const topic = "Food & Coffee Culture";
  const targetDate = "2026-10-30";

  console.log(`==================================================`);
  console.log(`[1/3] 로컬 환경에서 Gemini AI 학습지 생성 시작...`);
  console.log(`- 사용 모델: ${GEMINI_MODEL}`);
  console.log(`- 주제: ${topic}`);
  console.log(`- 날짜: ${targetDate}`);
  console.log(`==================================================`);

  if (!GEMINI_API_KEY) {
    console.error("❌ 오류: GEMINI_API_KEY가 .env 파일에 설정되어 있지 않습니다.");
    return;
  }

  try {
    // 1. 로컬에서 시간 제한 없이 안전하게 Gemini API 호출
    const geminiData = await callGeminiAPI(topic, targetDate);
    console.log("[1/3] ✅ AI 학습지 2페이지 생성 완료!");

    // 2. 💡 [추가] Vercel 전송 전, 로컬 PC에 JSON 파일로 안전하게 백업 저장
    const outputDir = path.resolve('local_outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const fileName = `worksheet_${targetDate}_${Date.now()}.json`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify({ topic, targetDate, ...geminiData }, null, 2), 'utf-8');
    console.log(`[2/3] 💾 로컬 백업 저장 완료: ${filePath}`);

    console.log("[3/3] Vercel 저장 전용 API로 데이터 전송 중...");

    // 3. 완성된 데이터를 Vercel 저장 API로 전송하여 Neon DB에 적재
    const response = await fetch(VERCEL_SAVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET_KEY
      },
      body: JSON.stringify({
        topic,
        targetDate,
        page1Data: geminiData.page1,
        page2Data: geminiData.page2
      })
    });

    const result = await response.json();
    if (response.ok) {
      console.log("==================================================");
      console.log("🎉 성공적으로 Vercel/Neon DB에 저장되었습니다!", result);
      console.log("👉 이제 브라우저에서 generator.html을 새로고침하여 히스토리를 확인하세요!");
      console.log("==================================================");
    } else {
      console.error("❌ Vercel 저장 실패 (하지만 로컬 폴더에 백업되어 있습니다):", result);
    }

  } catch (error) {
    console.error("❌ 실행 중 에러 발생:", error);
  }
}

async function callGeminiAPI(topic, targetDate) {
  const prompt = `Create a 2-page English learning worksheet about "${topic}" for date ${targetDate}. Return the result strictly in valid JSON format with keys "page1" and "page2".`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류 발생 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textResult = data.candidates[0].content.parts[0].text;
  
  // JSON 파싱 (마크다운 코드블록 백틱 제거)
  const cleanJsonStr = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJsonStr);
}

runLocalGeneration();