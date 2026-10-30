// api/generate-worksheet.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { topic, weekInfo, target_date, sequence, file_name } = req.body;
    
    // 환경 변수 키 가져오기 (공백 제거)
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

    if (!apiKey) {
      console.error('API Key Error: GEMINI_API_KEY is missing in Vercel environment variables.');
      return res.status(500).json({ success: false, error: 'Vercel에 GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.' });
    }

    const prompt = `You are an expert English curriculum writer for "English Community". 
Create a professional 2-page learning worksheet strictly based on: "${topic}".
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
    "questions": [{"q": "1. Question?", "answers": [{"en": "Answer", "kr": "번역"}]}]
  },
  "page2": {
    "topic": "${topic}",
    "todaysExpressions": [{"en": "expr", "kr": "의미", "exampleEn": "Ex", "exampleKr": "예문"}],
    "reviewExpressions": [{"en": "rev", "kr": "복습", "exampleEn": "Ex", "exampleKr": "예문"}],
    "storyText": "Story with #expr#...",
    "questions": [{"q": "1. Q?", "expr": "expr", "qKr": "번역"}]
  }
}`;

    // 사용자가 요청하신 gemini-3.8-flash 모델 유지
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const resultData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Google Gemini API Response Error:', JSON.stringify(resultData));
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