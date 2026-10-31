import { getDb } from './_lib/db.js';

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

    const sql = getDb();

    // 1. 팀 대표 전화번호 및 팀원 명단에서 조회 (최근 날짜 우선)
    const groups = await sql`
      SELECT id, date, group_no, facilitator, members
      FROM esl_meetup_groups
      WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${normalizedPhone}
         OR EXISTS (
           SELECT 1
           FROM REGEXP_MATCHES(COALESCE(members, ''),
             '(\+?[0-9][0-9 ()-]{7,}[0-9])', 'g') AS matched
           WHERE REGEXP_REPLACE(matched[1], '[^0-9]', '', 'g') = ${normalizedPhone}
         )
      ORDER BY date DESC, id DESC
      LIMIT 1
    `;
    const matchedGroup = groups[0] || null;

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

    // 💡 P0 보안 개선: 형식만 맞으면 통과되던 취약점 및 DB 에러 시 무조건 성공하던 Fallback 완전 차단
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