// api/admin.js 내의 핸들러에 아래 로직 추가/통합

if (req.method === 'GET') {
  const type = req.query.type;
  const targetDate = req.query.date;

  if (type === 'meetups') {
    // 기존 밋업 그룹 조회 로직...
  } else if (type === 'schedules') {
    // 💡 1. 밋업 일정(esl_schedules) 조회 로직 추가
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
    // 전체 문의 내역 조회
    const inquiries = await sql`SELECT * FROM esl_inquiries ORDER BY id DESC;`;
    return res.status(200).json({ success: true, data: inquiries });
  }
}

if (req.method === 'PUT') {
  const { target, id, name, phone, role, level, preferred_time, location, referrer, facilitator, members, target_date, time_slot } = req.body;

  if (target === 'schedule') {
    // 💡 2. 밋업 일정 수정 로직 추가
    await sql`
      UPDATE esl_schedules 
      SET name = ${name}, phone = ${phone}, target_date = ${target_date}, time_slot = ${time_slot}
      WHERE id = ${id};
    `;
  } else if (target === 'meetup') {
    // 기존 그룹 수정...
  } else {
    // 기존 문의 수정...
  }
  return res.status(200).json({ success: true, message: '수정 완료' });
}

if (req.method === 'DELETE') {
  const { id, target, archive_old } = req.body;
  
  if (target === 'schedule') {
    // 💡 3. 개별 밋업 일정 삭제 로직 추가
    await sql`DELETE FROM esl_schedules WHERE id = ${id};`;
    return res.status(200).json({ success: true, message: '일정 삭제 완료' });
  }
  // 기존 삭제 로직...
}