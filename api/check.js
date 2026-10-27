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
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 날짜의 밋업 그룹 데이터 조회
    const groups = await sql`
      SELECT * FROM esl_meetup_groups 
      WHERE date = ${today};
    `;

    // 입력한 전화번호가 members 컬럼에 포함된 그룹 찾기
    let matchedGroup = null;
    for (const group of groups) {
      if (group.members && group.members.includes(phone.trim())) {
        matchedGroup = group;
        break;
      }
    }

    if (!matchedGroup) {
      return res.status(404).json({ success: false, error: '오늘 날짜로 매칭된 밋업 그룹을 찾을 수 없습니다. (전화번호를 확인해 주세요)' });
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