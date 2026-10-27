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

    // 날짜 제한 없이 모든 밋업 그룹 데이터를 불러와서 검색 (최근 등록순)
    const groups = await sql`
      SELECT * FROM esl_meetup_groups 
      ORDER BY id DESC;
    `;

    let matchedGroup = null;
    for (const group of groups) {
      if (group.members && group.members.includes(cleanPhone)) {
        matchedGroup = group;
        break;
      }
    }

    if (!matchedGroup) {
      return res.status(404).json({ 
        success: false, 
        error: '오늘 날짜로 매칭된 밋업 그룹을 찾을 수 없습니다. (전화번호를 확인해 주세요) 문의가 필요하면 어드민(010-3450-2090)으로 연락하시면 안내드리겠습니다.' 
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        group_no: matchedGroup.group_no,
        facilitator: matchedGroup.facilitator,
        members: matchedGroup.members,
        date: matchedGroup.date
      }
    });

  } catch (error) {
    console.error('Check Group Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}