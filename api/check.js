import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ success: false, error: '전화번호를 입력해 주세요.' });
  }

  const cleanPhone = phone.trim();
  const normalizedPhone = cleanPhone.replace(/[^0-9]/g, '');

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }

    const sql = neon(process.env.DATABASE_URL);

    // 1. 밋업 그룹(esl_meetup_groups) 팀원 명단에서 전화번호 검색
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

    // 2. 전체 문의/신청자 테이블(esl_inquiries)에서 등록된 회원인지 검증
    const inquiries = await sql`
      SELECT id, name, phone 
      FROM esl_inquiries 
      WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${normalizedPhone}
      LIMIT 1;
    `;

    if (inquiries && inquiries.length > 0) {
      return res.status(200).json({ 
        success: true, 
        message: '회원 등록이 확인되었습니다.',
        data: { phone: inquiries[0].phone }
      });
    }

    // 💡 P0 보안 개선: 형식만 맞으면 통과되던 취약점 및 DB 에러 시 무조건 성공하던 Fallback 제거
    return res.status(403).json({ 
      success: false, 
      error: '등록되지 않은 휴대폰 번호입니다. 번호를 다시 확인해 주세요.' 
    });

  } catch (error) {
    console.error('Check API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: '인증을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' 
    });
  }
}