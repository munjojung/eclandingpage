// api/worksheet.js
import { neon } from '@neondatabase/serverless';
import {
  verifyAdminSession,
  requireSameOrigin
} from './_lib/admin-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : {};

  const action =
    body.action ||
    (req.method === 'DELETE' ? 'delete' : 'generate');

  // =========================================================
  // 1. 삭제 요청 보안 검사
  // =========================================================
  // 관리자 세션 검증과 동일 출처 검증을 모두 통과해야 합니다.
  if (action === 'delete') {
    let authenticated = false;

    try {
      authenticated = await verifyAdminSession(req);
    } catch (error) {
      console.error(
        'Worksheet delete session verification error:',
        error
      );

      return res.status(500).json({
        success: false,
        error: '관리자 세션 확인 중 서버 오류가 발생했습니다.'
      });
    }

    if (!authenticated) {
      return res.status(401).json({
        success: false,
        error: '관리자 로그인이 필요하거나 세션이 만료되었습니다.'
      });
    }

    const originError = requireSameOrigin(req);

    if (originError) {
      return res.status(403).json({
        success: false,
        error: originError
      });
    }
  }

  // =========================================================
  // 2. 학습지 생성 (Generate)
  // =========================================================
  if (action === 'generate') {
    try {
      const {
        topic,
        weekInfo,
        target_date,
        sequence,
        file_name,
        adminPassword
      } = body;

      const correctPassword = process.env.ADMIN_PASSWORD
        ? process.env.ADMIN_PASSWORD.trim()
        : '';

      if (correctPassword && adminPassword !== correctPassword) {
        return res.status(401).json({
          success: false,
          error: '관리자 비밀번호가 올바르지 않습니다. 권한이 없습니다.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.trim()
        : '';

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'Vercel에 GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.'
        });
      }

      if (
        typeof topic !== 'string' ||
        !topic.trim() ||
        topic.length > 300
      ) {
        return res.status(400).json({
          success: false,
          error: '주제(topic)는 1~300자 이내로 입력해야 합니다.'
        });
      }

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
  "target_date": "${target_date || ''}",
  "weekInfo": "${weekInfo || ''}",
  "sequence": "${sequence || ''}",
  "file_name": "${file_name || ''}",
  "topic": "${topic.trim()}",
  "page1": {
    "title": "Daily Talk & Share",
    "subTopic": "${topic.trim()}",
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
    "topic": "${topic.trim()}",
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

      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

      let geminiRes;
      let resultData;
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        attempt++;

        geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ]
          })
        });

        resultData = await geminiRes.json();

        if (geminiRes.ok) break;

        const errorMessage =
          resultData.error?.message || '';

        if (
          attempt < maxRetries &&
          (
            geminiRes.status === 503 ||
            errorMessage.includes('high demand')
          )
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, 2000)
          );

          continue;
        }

        break;
      }

      if (!geminiRes.ok) {
        throw new Error(
          resultData.error?.message ||
          `Gemini API 오류 발생 (${geminiRes.status})`
        );
      }

      let rawText =
        resultData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      rawText = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsedJSON = JSON.parse(rawText);

      return res.status(200).json({
        success: true,
        data: parsedJSON
      });

    } catch (error) {
      console.error('Generate Error:', error);

      return res.status(500).json({
        success: false,
        error: error.message || '생성 중 오류 발생'
      });
    }
  }

  // =========================================================
  // 3. 학습지 DB 삭제 (Delete)
  // =========================================================
  // 위의 관리자 세션 검사와 출처 검사를 통과한 경우에만 실행됩니다.
  if (action === 'delete') {
    try {
      const { id, file_name } = body;

      const hasId =
        id !== undefined &&
        id !== null &&
        id !== '';

      const hasFileName =
        file_name !== undefined &&
        file_name !== null &&
        file_name !== '';

      // ID와 파일명 중 반드시 하나만 지정해야 합니다.
      if (hasId === hasFileName) {
        return res.status(400).json({
          success: false,
          error: '삭제할 ID 또는 파일명 중 하나만 지정해 주세요.'
        });
      }

      const connectionString =
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DATABASE_URL;

      if (!connectionString) {
        return res.status(500).json({
          success: false,
          error: 'DB 연결 문자열이 설정되지 않았습니다.'
        });
      }

      const sql = neon(connectionString);
      let deletedRows;

      // ---------------------------------------------
      // 3-1. ID로 삭제
      // ---------------------------------------------
      if (hasId) {
        const normalizedId =
          typeof id === 'number'
            ? String(id)
            : typeof id === 'string'
              ? id.trim()
              : '';

        // 숫자로만 이루어진 값인지 확인합니다.
        if (!/^\d+$/.test(normalizedId)) {
          return res.status(400).json({
            success: false,
            error: '삭제 ID는 양의 정수여야 합니다.'
          });
        }

        const numericId = Number(normalizedId);

        if (
          !Number.isSafeInteger(numericId) ||
          numericId <= 0
        ) {
          return res.status(400).json({
            success: false,
            error: '삭제 ID가 허용 범위를 벗어났습니다.'
          });
        }

        deletedRows = await sql`
          DELETE FROM worksheets
          WHERE id = ${numericId}
          RETURNING id
        `;
      }

      // ---------------------------------------------
      // 3-2. 파일명으로 삭제
      // ---------------------------------------------
      else {
        if (typeof file_name !== 'string') {
          return res.status(400).json({
            success: false,
            error: '파일명은 문자열이어야 합니다.'
          });
        }

        const normalizedFileName = file_name.trim();

        if (
          !normalizedFileName ||
          normalizedFileName.length > 255 ||
          normalizedFileName === '.' ||
          normalizedFileName === '..' ||
          /[\\/\u0000-\u001f]/.test(normalizedFileName)
        ) {
          return res.status(400).json({
            success: false,
            error: '파일명 형식이 올바르지 않습니다.'
          });
        }

        deletedRows = await sql`
          DELETE FROM worksheets
          WHERE file_name = ${normalizedFileName}
          RETURNING id
        `;
      }

      // ---------------------------------------------
      // 3-3. 실제 DB 삭제 결과 확인
      // ---------------------------------------------
      if (
        !Array.isArray(deletedRows) ||
        deletedRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error: '삭제할 학습지 항목을 찾을 수 없습니다.'
        });
      }

      return res.status(200).json({
        success: true,
        deletedCount: deletedRows.length,
        message: '학습지 DB 항목이 삭제되었습니다.'
      });

    } catch (error) {
      console.error('Delete Error:', error);

      return res.status(500).json({
        success: false,
        error: 'DB 삭제 중 오류가 발생했습니다.'
      });
    }
  }

  // =========================================================
  // 4. 휴대폰 번호 조회 (Check)
  // =========================================================
  if (action === 'check') {
    try {
      const { phone } = body;

      const connectionString =
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DATABASE_URL;

      if (
        !connectionString ||
        typeof phone !== 'string' ||
        !phone.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: '전화번호 또는 DB 설정이 누락되었습니다.'
        });
      }

      const sql = neon(connectionString);
      const cleanPhone = phone.replace(/[^0-9]/g, '');

      if (
        cleanPhone.length < 8 ||
        cleanPhone.length > 15
      ) {
        return res.status(400).json({
          success: false,
          error: '전화번호 형식이 올바르지 않습니다.'
        });
      }

      const rows = await sql`
        SELECT *
        FROM applicants
        WHERE REPLACE(phone, '-', '') = ${cleanPhone}
        LIMIT 1
      `;

      if (rows && rows.length > 0) {
        return res.status(200).json({
          success: true,
          data: {
            group_no: rows[0].group_no || '1',
            date: rows[0].date || '2026년 최신 세션',
            facilitator: rows[0].facilitator || '관리자',
            members:
              rows[0].members ||
              rows[0].name ||
              phone
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: '등록되지 않은 휴대폰 번호입니다.'
      });

    } catch (error) {
      console.error('Check Error:', error);

      return res.status(500).json({
        success: false,
        error: '조회 중 서버 오류가 발생했습니다.'
      });
    }
  }

  return res.status(400).json({
    success: false,
    error: 'Invalid Action'
  });
}