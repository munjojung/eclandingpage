// api/generate-worksheet.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { topic, weekInfo, target_date, sequence, file_name } = req.body;
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Vercel에 GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.' });
    }

    // 📌 정확히 10문항씩 생성하도록 요청하는 프롬프트
    const prompt = `You are an expert English curriculum writer for "English Community". 
Create a professional 2-page learning worksheet strictly based on: "${topic}".

CRITICAL REQUIREMENTS:
1. Page 1 (Daily Talk & Share): Must contain EXACTLY 10 discussion questions about "${topic}". Each question must have EXACTLY 2 sample response choices with English sentences and Korean translations.
2. Page 2 (Essay Topic):
   - 3 Today's Key Expressions with Korean meaning and example sentences.
   - 3 Review Expressions with Korean meaning and example sentences.
   - A narrative story incorporating all 6 expressions wrapped in hashtags like #expression#.
   - EXACTLY 10 Essay Discussion Questions, each linked to an expression.

Output ONLY raw JSON matching this exact structure without markdown ticks:
{
  "target_date": "${target_date}",
  "weekInfo": "${weekInfo}",
  "sequence": "${sequence}",
  "file_name": "${file_name}",
  "topic": "${topic}",
  "page1": {
    "title": "Daily Talk & Share",
    "subTopic": "${topic}",
    "questions": [
      {
        "q": "1. Question?",
        "answers": [
          {"en": "Answer 1", "kr": "번역 1"},
          {"en": "Answer 2", "kr": "번역 2"}
        ]
      }
    ]
  },
  "page2": {
    "topic": "${topic}",
    "todaysExpressions": [
      {"en": "expr 1", "kr": "의미 1", "exampleEn": "Ex 1", "exampleKr": "예문 1"},
      {"en": "expr 2", "kr": "의미 2", "exampleEn": "Ex 2", "exampleKr": "예문 2"},
      {"en": "expr 3", "kr": "의미 3", "exampleEn": "Ex 3", "exampleKr": "예문 3"}
    ],
    "reviewExpressions": [
      {"en": "rev 1", "kr": "복습 1", "exampleEn": "Ex 1", "exampleKr": "예문 1"},
      {"en": "rev 2", "kr": "복습 2", "exampleEn": "Ex 2", "exampleKr": "예문 2"},
      {"en": "rev 3", "kr": "복습 3", "exampleEn": "Ex 3", "exampleKr": "예문 3"}
    ],
    "storyText": "Story using all expressions wrapped in #hashtags#...",
    "questions": [
      {"q": "1. Question?", "expr": "expr 1", "qKr": "한글질문 번역"}
    ]
  }
}`;

    // 요청하신 gemini-3.8-flash 모델 유지 및 트래픽 폭증 대응 자동 재시도 로직
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    let geminiRes;
    let resultData;
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      resultData = await geminiRes.json();
      if (geminiRes.ok) break;

      const errorMessage = resultData.error?.message || '';
      if (attempt < maxRetries && (geminiRes.status === 503 || errorMessage.includes('high demand'))) {
        console.warn(`Attempt ${attempt} failed due to high demand. Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      break;
    }

    if (!geminiRes.ok) {
      throw new Error(resultData.error?.message || `Gemini API 오류 발생 (상태 코드: ${geminiRes.status})`);
    }

    let rawText = resultData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedJSON = JSON.parse(rawText);

    return res.status(200).json({ success: true, data: parsedJSON });
  } catch (error) {
    console.error('Server Catch Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'AI 학습지 생성 중 서버 내부 오류가 발생했습니다.' });
  }
}