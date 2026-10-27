import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234!'; 

  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: '인증에 실패했습니다. 관리자 비밀번호를 확인해 주세요.' });
  }

  try {
    const { type } = req.query; // 'inquiries' 또는 'meetups' 구분

    // 1. 밋업 그룹 조회 (GET /api/admin?type=meetups)
    if (req.method === 'GET' && type === 'meetups') {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await sql`SELECT * FROM esl_meetup_groups WHERE date = ${today} ORDER BY group_no ASC;`;
      return res.status(200).json({ success: true, data: rows });
    }

    // 2. 일반 문의 목록 조회 (GET /api/admin)
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM esl_inquiries ORDER BY created_at DESC;`;
      return res.status(200).json({ success: true, data: rows });
    }

    // 3. 일괄 데이터 추가 (POST - CSV 업로드용)
    if (req.method === 'POST') {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '추가할 데이터가 없습니다.' });
      }

      for (const item of items) {
        await sql`
          INSERT INTO esl_inquiries (name, phone, role, level, preferred_time, location, referrer)
          VALUES (${item.name || ''}, ${item.phone || ''}, ${item.role || ''}, ${item.level || ''}, ${item.preferred_time || ''}, ${item.location || ''}, ${item.referrer || ''});
        `;
      }
      return res.status(200).json({ success: true, message: '성공적으로 등록되었습니다.' });
    }

    // 4. 정보 수정 (PUT)
    if (req.method === 'PUT') {
      const { target } = req.body;

      // 4-1. 밋업 그룹 수정 (팀원 재배치)
      if (target === 'meetup') {
        const { id, facilitator, members } = req.body;
        if (!id) return res.status(400).json({ error: '그룹 ID가 필요합니다.' });

        const updated = await sql`
          UPDATE esl_meetup_groups 
          SET facilitator=${facilitator}, members=${members}
          WHERE id=${id}
          RETURNING *;
        `;
        return res.status(200).json({ success: true, data: updated[0] });
      }

      // 4-2. 일반 문의 정보 수정
      const { id, name, phone, role, level, preferred_time, location, referrer } = req.body;
      if (!id) return res.status(400).json({ error: 'ID가 필요합니다.' });

      const updated = await sql`
        UPDATE esl_inquiries 
        SET name=${name}, phone=${phone}, role=${role}, level=${level}, 
            preferred_time=${preferred_time}, location=${location}, referrer=${referrer}
        WHERE id=${id}
        RETURNING *;
      `;
      return res.status(200).json({ success: true, data: updated[0] });
    }

    // 5. 항목 삭제 (DELETE)
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID가 필요합니다.' });

      await sql`DELETE FROM esl_inquiries WHERE id=${id};`;
      return res.status(200).json({ success: true, message: '삭제되었습니다.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}