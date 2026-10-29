export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 관리자 세션 검증 (헤더 또는 쿠키)
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, error: '관리자 인증이 필요합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: 'AI 생성 기능이 설정되지 않았습니다.' });
  }

  const { topic, weekInfo } = req.body;
  const customTopic = topic || 'Mountain Hiking';

  try {
    const systemPrompt = `You are an expert English conversation curriculum writer for "English Community".
Create a 2-page learning worksheet strictly based on the topic: "${customTopic}".
Output ONLY raw JSON matching this structure without markdown:
{
  "weekInfo": "${weekInfo || '2026년 10월 29일 수요일'}",
  "topic": "${customTopic}",
  "page1": {
    "title": "Daily Talk & Share",
    "subTopic": "${customTopic}",
    "questions": [
      {
        "q": "1. Question text here?",
        "answers": [
          {"en": "Sample answer 1 in English", "kr": "한글 번역 1"},
          {"en": "Sample answer 2 in English", "kr": "한글 번역 2"}
        ]
      }
    ]
  },
  "page2": {
    "topic": "${customTopic}",
    "todaysExpressions": [
      {"en": "expr 1", "kr": "의미 1", "exampleEn": "Ex 1", "exampleKr": "예문 번역 1"}
    ],
    "reviewExpressions": [
      {"en": "rev 1", "kr": "복습 1", "exampleEn": "Ex 1", "exampleKr": "예문 번역 1"}
    ],
    "storyText": "Full narrative story using expressions in #hashtags#...",
    "questions": [
      {"q": "1. Question?", "expr": "expr 1", "qKr": "한글번역"}
    ]
  }
}`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const resData = await response.json();
    let rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedJSON = JSON.parse(rawText);
    return res.status(200).json({ success: true, data: parsedJSON });

  } catch (error) {
    console.error('Worksheet Generation Error:', error);
    return res.status(500).json({ success: false, error: '학습지 생성 중 오류가 발생했습니다.' });
  }
}