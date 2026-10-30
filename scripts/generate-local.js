// scripts/generate-local.js
import fs from 'fs';
import path from 'path';

// 📌 .env 파일에 정의된 환경 변수들을 가져옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; 

const VERCEL_SAVE_API_URL = "https://eclandingpage-kappa.vercel.app/api/save-worksheet";

// 📌 지연 함수 (재시도 대기용)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // 1. 재시도 로직이 포함된 Gemini API 호출 함수 실행
    const geminiData = await callGeminiAPIWithRetry(topic, targetDate);
    console.log("[1/3] ✅ AI 학습지 2페이지 생성 완료!");

    // 2. Vercel 전송 전, 로컬 PC에 JSON 파일로 안전하게 백업 저장
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
    console.error("❌ 실행 중 최종 에러 발생:", error);
  }
}

// 📌 503 에러 발생 시 최대 3회까지 재시도하는 래퍼 함수 (5초 -> 10초 -> 15초 대기)
async function callGeminiAPIWithRetry(topic, targetDate, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiAPI(topic, targetDate);
    } catch (error) {
      const isServiceUnavailable = error.message.includes('503') || error.message.includes('UNAVAILABLE');
      
      if (isServiceUnavailable && attempt < maxRetries) {
        const waitTime = attempt * 5000; // 1차 시도 후 5초, 2차 시도 후 10초 대기
        console.warn(`⚠️ [경고] 서버 과부하(503) 감지. ${attempt}회차 시도 실패. ${waitTime / 1000}초 후 다시 시도합니다...`);
        await sleep(waitTime);
      } else {
        throw error; // 503이 아니거나 최대 재시도 횟수를 초과한 경우 에러 발생
      }
    }
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