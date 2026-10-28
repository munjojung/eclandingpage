import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 헤더가 올바르지 않습니다.' });
  }

  const token = authHeader.split(' ')[1];
  const adminSecret = process.env.ADMIN_PASSWORD || '1234';

  if (token !== adminSecret) {
    return res.status(401).json({ error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // GET 요청: 문의 내역 또는 밋업 그룹 조회 (날짜 필터 지원)
    if (req.method === 'GET') {
      const type = req.query.type;
      const targetDate = req.query.date; // YYYY-MM-DD (선택)

      if (type === 'meetups') {
        let meetups;
        if (targetDate) {
          meetups = await sql`
            SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members, created_at 
            FROM esl_meetup_groups 
            WHERE date = ${targetDate}::date 
            ORDER BY group_no ASC;
          `;
        } else {
          meetups = await sql`
            SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members, created_at 
            FROM esl_meetup_groups 
            ORDER BY date DESC, group_no ASC;
          `;
        }

        // 70일 경과 데이터 백업용 알림 데이터 수집
        const oldMeetups = await sql`
          SELECT id, TO_CHAR(date, 'YYYY-MM-DD') as date, group_no, facilitator, members 
          FROM esl_meetup_groups 
          WHERE date < CURRENT_DATE - INTERVAL '70 days'
          ORDER BY date ASC;
        `;

        return res.status(200).json({ 
          success: true, 
          data: meetups,
          archived_candidates: oldMeetups 
        });
      } else {
        const inquiries = await sql`
          SELECT * FROM esl_inquiries ORDER BY id DESC;
        `;
        return res.status(200).json({ success: true, data: inquiries });
      }
    }

    // POST/PUT/DELETE 로직 유지
    if (req.method === 'PUT') {
      const { target, id, name, phone, role, level, preferred_time, location, referrer, facilitator, members } = req.body;

      if (target === 'meetup') {
        await sql`
          UPDATE esl_meetup_groups 
          SET facilitator = ${facilitator}, members = ${members} 
          WHERE id = ${id};
        `;
      } else {
        await sql`
          UPDATE esl_inquiries 
          SET name = ${name}, phone = ${phone}, role = ${role}, level = ${level}, 
              preferred_time = ${preferred_time}, location = ${location}, referrer = ${referrer}
          WHERE id = ${id};
        `;
      }
      return res.status(200).json({ success: true, message: '수정 완료' });
    }

    if (req.method === 'DELETE') {
      const { id, target, archive_old } = req.body;
      if (archive_old) {
        // 70일 지난 데이터 일괄 삭제 (백업 후 정리용)
        await sql`DELETE FROM esl_meetup_groups WHERE date < CURRENT_DATE - INTERVAL '70 days';`;
        return res.status(200).json({ success: true, message: '70일 이전 데이터 정리 완료' });
      }
      await sql`DELETE FROM esl_inquiries WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: '삭제 완료' });
    }

    if (req.method === 'POST') {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '유효하지 않은 데이터입니다.' });
      }
      for (const item of items) {
        await sql`
          INSERT INTO esl_inquiries (name, phone, role, level, preferred_time, location, referrer)
          VALUES (${item.name}, ${item.phone}, ${item.role}, ${item.level}, ${item.preferred_time}, ${item.location}, ${item.referrer});
        `;
      }
      return res.status(200).json({ success: true, message: '일괄 등록 완료' });
    }

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ success: false, error: '서버 오류: ' + error.message });
  }
}