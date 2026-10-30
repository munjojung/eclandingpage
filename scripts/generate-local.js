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
  console.log(`[1/3] 로컬 백업 확인 및 학습지 처리 시작...`);
  console.log(`- 주제: ${topic}`);
  console.log(`- 날짜: ${targetDate}`);
  console.log(`==================================================`);

  const outputDir = path.resolve('local_outputs');
  let geminiData = null;
  let targetFilePath = null; // 📌 관리 중인 백업 파일 경로 추적용 변수

  // 📌 1단계: local_outputs 폴더에 전송 실패로 남아있는 기존 백업 파일 검사
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    const matchedFiles = files.filter(f => f.startsWith(`worksheet_${targetDate}`) && f.endsWith('.json'));
    
    if (matchedFiles.length > 0) {
      matchedFiles.sort().reverse();
      const latestFile = matchedFiles[0];
      targetFilePath = path.join(outputDir, latestFile);
      
      console.log(`🔍 [발견] 전송 실패로 남아있는 기존 백업 파일을 로드합니다: ${targetFilePath}`);
      const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      geminiData = {
        page1: parsed.page1 || parsed.page1Data,
        page2: parsed.page2 || parsed.page2Data
      };
      console.log("[1/3] ✅ AI 콜을 생략하고 기존 로컬 백업 데이터를 재사용합니다!");
    }
  }

  // 📌 로컬 백업이 없는 경우에만 Gemini AI 호출 및 새 백업 저장 수행
  if (!geminiData) {
    if (!GEMINI_API_KEY) {
      console.error("❌ 오류: GEMINI_API_KEY가 .env 파일에 설정되어 있지 않습니다.");
      return;
    }

    console.log("🤖 로컬 백업이 없어 Gemini AI를 새롭게 호출합니다...");
    geminiData = await callGeminiAPIWithRetry(topic, targetDate);
    console.log("[1/3] ✅ AI 학습지 2페이지 생성 완료!");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const fileName = `worksheet_${targetDate}_${Date.now()}.json`;
    targetFilePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(targetFilePath, JSON.stringify({ topic, targetDate, ...geminiData }, null, 2), 'utf-8');
    console.log(`[2/3] 💾 전송 대비용 로컬 백업 저장 완료: ${targetFilePath}`);
  } else {
    console.log(`[2/3] 💾 기존 로컬 백업을 사용하므로 새 백업 생성을 건너뜁니다.`);
  }

  console.log("[3/3] Vercel 저장 전용 API로 데이터 전송 중...");

  try {
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

      // 💡 [핵심] 전송 성공 시, 더 이상 필요 없는 로컬 백업 파일을 자동 삭제하여 중복 방지
      if (targetFilePath && fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
        console.log(`🗑️ 전송 완료로 인해 로컬 백업 파일이 안전하게 정리되었습니다: ${targetFilePath}`);
      }

      console.log("👉 이제 브라우저에서 generator.html을 새로고침하여 히스토리를 확인하세요!");
      console.log("==================================================");
    } else {
      console.error("❌ Vercel 저장 실패. (다음 실행 시 재시도할 수 있도록 로컬 백업 파일은 유지됩니다):", result);
    }

  } catch (error) {
    console.error("❌ Vercel 전송 중 네트워크 에러 발생 (로컬 백업은 유지됨):", error);
  }
}

// 📌 503 에러 발생 시 최대 3회까지 재시도하는 함수 (5초 -> 10초 -> 15초 대기)
async function callGeminiAPIWithRetry(topic, targetDate, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiAPI(topic, targetDate);
    } catch (error) {
      const isServiceUnavailable = error.message.includes('503') || error.message.includes('UNAVAILABLE');
      
      if (isServiceUnavailable && attempt < maxRetries) {
        const waitTime = attempt * 5000; 
        console.warn(`⚠️ [경고] 서버 과부하(503) 감지. ${attempt}회차 시도 실패. ${waitTime / 1000}초 후 다시 시도합니다...`);
        await sleep(waitTime);
      } else {
        throw error;
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
  
  const cleanJsonStr = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJsonStr);
}

runLocalGeneration();