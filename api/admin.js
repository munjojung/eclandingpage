import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // 💡 P0 보안 개선: 기본 비밀번호 제거 및 안전한 환경 변수 검증
  const adminSecret = process.env.ADMIN_PASSWORD;

  if (!adminSecret || adminSecret.length < 16) {
    console.error('ADMIN_PASSWORD is missing or too short');
    return res.status(503).json({
      success: false,
      error: '관리자 인증 설정이 올바르지 않습니다.'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '인증 헤더가 올바르지 않습니다.' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== adminSecret) {
    return res.status(401).json({ success: false, error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const type = req.query.type;
      const targetDate = req.query.date;

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
      } else if (type === 'schedules') {
        let schedules;
        if (targetDate) {
          schedules = await sql`
            SELECT id, name, phone, TO_CHAR(target_date, 'YYYY-MM-DD') as target_date, time_slot, created_at 
            FROM esl_schedules 
            WHERE target_date = ${targetDate}::date 
            ORDER BY target_date DESC, id DESC;
          `;
        } else {
          schedules = await sql`
            SELECT id, name, phone, TO_CHAR(target_date, 'YYYY-MM-DD') as target_date, time_slot, created_at 
            FROM esl_schedules 
            ORDER BY target_date DESC, id DESC;
          `;
        }
        return res.status(200).json({ success: true, data: schedules });
      } else {
        const inquiries = await sql`
          SELECT * FROM esl_inquiries ORDER BY id DESC;
        `;
        return res.status(200).json({ success: true, data: inquiries });
      }
    }

    if (req.method === 'PUT') {
      const { target, id, name, phone, role, level, preferred_time, location, referrer, facilitator, members, target_date, time_slot } = req.body;

      if (target === 'schedule') {
        await sql`
          UPDATE esl_schedules 
          SET name = ${name}, phone = ${phone}, target_date = ${target_date}, time_slot = ${time_slot}
          WHERE id = ${id};
        `;
      } else if (target === 'meetup') {
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
      
      if (target === 'schedule') {
        await sql`DELETE FROM esl_schedules WHERE id = ${id};`;
        return res.status(200).json({ success: true, message: '일정 삭제 완료' });
      }
      
      if (archive_old) {
        await sql`DELETE FROM esl_meetup_groups WHERE date < CURRENT_DATE - INTERVAL '70 days';`;
        return res.status(200).json({ success: true, message: '70일 이전 데이터 정리 완료' });
      }
      await sql`DELETE FROM esl_inquiries WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: '삭제 완료' });
    }

    if (req.method === 'POST') {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: '유효하지 않은 데이터입니다.' });
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
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}