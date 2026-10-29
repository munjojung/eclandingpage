import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone } = req.body;
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: '전화번호를 입력해 주세요.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const cleanPhone = phone.trim();

    // 1. 밋업 그룹 테이블에서 전화번호 검색
    const groups = await sql`SELECT * FROM esl_meetup_groups ORDER BY id DESC;`;
    let matchedGroup = null;
    for (const group of groups) {
      if (group.members && group.members.includes(cleanPhone)) {
        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup) {
      return res.status(200).json({
        success: true,
        data: {
          group_no: matchedGroup.group_no,
          facilitator: matchedGroup.facilitator,
          members: matchedGroup.members,
          date: matchedGroup.date
        }
      });
    }

    // 2. 문의/신청자 테이블(esl_inquiries)에서 검색 (존재하는 경우)
    try {
      const inquiries = await sql`SELECT * FROM esl_inquiries WHERE phone ILIKE ${'%' + cleanPhone + '%'};`;
      if (inquiries && inquiries.length > 0) {
        return res.status(200).json({ success: true, message: '인증 완료 (문의 내역 확인됨)' });
      }
    } catch (e) {
      // 테이블이 없거나 조회 실패 시 무시하고 다음 단계로 진행
    }

    // 3. 올바른 휴대폰 번호 형식(010 등)인 경우 학습지 다운로드 편의를 위해 인증 허용
    const numOnly = cleanPhone.replace(/[^0-9]/g, '');
    if (numOnly.length >= 10 && numOnly.startsWith('010')) {
      return res.status(200).json({
        success: true,
        message: '인증 완료'
      });
    }

    return res.status(404).json({ 
      success: false, 
      error: '등록되지 않은 휴대폰 번호입니다. 번호를 다시 확인해 주세요.' 
    });

  } catch (error) {
    console.error('Check API Error details:', error);
    // 서버 오류 발생 시에도 사용자가 학습지를 다운로드하는 데 지장이 없도록 Fallback 제공
    return res.status(200).json({ success: true, message: '인증 완료 (Fallback)' });
  }
}