import { getDb } from './_lib/db.js';
import { verifyAdminSession, requireSameOrigin } from './_lib/admin-session.js';

const choices={meetups:['draft','scheduled','closed','cancelled','completed'],members:['pending','active','suspended','withdrawn'],applications:['applied','approved','rejected','waitlisted']};
export default async function handler(req,res){
 if(!['GET','PATCH'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(req.method==='PATCH'){const error=requireSameOrigin(req);if(error)return res.status(403).json({error});}
 try{
  if(!await verifyAdminSession(req))return res.status(401).json({error:'관리자 로그인이 필요합니다.'});
  if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='dev')return res.status(403).json({error:'dev Preview 전용입니다.'});
  const sql=getDb(),type=req.method==='GET'?req.query.type:req.body?.type;
  if(req.method==='GET'){
   let data;
   if(type==='meetups')data=await sql`SELECT meetup_id,meetup_code,title,to_char(meetup_date,'YYYY-MM-DD') meetup_date,location,status FROM esl_v2.meetups ORDER BY meetup_date DESC`;
   else if(type==='groups')data=await sql`SELECT g.group_id,m.meetup_code,g.group_no,u.real_name AS facilitator,(SELECT count(*)::int FROM esl_v2.meetup_assignments a WHERE a.group_id=g.group_id) AS participants FROM esl_v2.meetup_groups g JOIN esl_v2.meetups m ON m.meetup_id=g.meetup_id LEFT JOIN esl_v2.users u ON u.user_id=g.facilitator_user_id ORDER BY m.meetup_date DESC,g.group_no`;
   else if(type==='members')data=await sql`SELECT mb.member_id,u.real_name,mb.nickname,mb.english_level,mb.status FROM esl_v2.members mb JOIN esl_v2.users u ON u.user_id=mb.user_id ORDER BY mb.member_id`;
   else if(type==='applications')data=await sql`SELECT a.application_id,m.meetup_code,u.real_name,a.status FROM esl_v2.meetup_applications a JOIN esl_v2.meetups m ON m.meetup_id=a.meetup_id JOIN esl_v2.users u ON u.user_id=a.user_id ORDER BY a.application_id`;
   else if(type==='assignments')data=await sql`SELECT a.assignment_id,m.meetup_code,g.group_no,u.real_name,a.role FROM esl_v2.meetup_assignments a JOIN esl_v2.meetup_groups g ON g.group_id=a.group_id JOIN esl_v2.meetups m ON m.meetup_id=a.meetup_id JOIN esl_v2.meetup_applications ap ON ap.application_id=a.application_id JOIN esl_v2.users u ON u.user_id=ap.user_id ORDER BY m.meetup_date DESC,g.group_no`;
   else if(type==='attendance')data=await sql`SELECT t.assignment_id,m.meetup_code,u.real_name,t.status FROM esl_v2.attendance t JOIN esl_v2.meetup_assignments a ON a.assignment_id=t.assignment_id JOIN esl_v2.meetups m ON m.meetup_id=a.meetup_id JOIN esl_v2.meetup_applications ap ON ap.application_id=a.application_id JOIN esl_v2.users u ON u.user_id=ap.user_id ORDER BY m.meetup_date DESC`;
   else return res.status(400).json({error:'Unknown type'});
   return res.status(200).json({success:true,data});
  }
  const {id,status}=req.body||{};
  if(!Number.isSafeInteger(Number(id))||Number(id)<=0||!choices[type]?.includes(status))return res.status(400).json({error:'잘못된 요청'});
  let updated;
  if(type==='meetups')updated=await sql`UPDATE esl_v2.meetups SET status=${status},updated_at=now() WHERE meetup_id=${Number(id)} RETURNING meetup_id`;
  else if(type==='members'){
    const actorId=Number(process.env.V2_ADMIN_USER_ID);
    if(!Number.isSafeInteger(actorId)||actorId<=0)
      return res.status(503).json({error:'V2_ADMIN_USER_ID 설정이 필요합니다. 회원 상태 변경을 중단했습니다.'});
    // The legacy password is shared: this maps to one designated admin account, not an individual login identity.
    const actor=await sql`SELECT user_id FROM esl_v2.users WHERE user_id=${actorId} AND account_status='active' LIMIT 1`;
    if(!actor.length)return res.status(403).json({error:'설정된 V2 관리자 사용자를 찾을 수 없습니다.'});
    const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
    if(!reason||reason.length>500)return res.status(400).json({error:'회원 상태 변경 사유를 1~500자로 입력하세요.'});
    // Single SQL statement: state, business history, audit log commit or roll back together.
    // A no-op status change writes no history or audit event.
    updated=await sql`
      WITH previous AS MATERIALIZED (
        SELECT member_id,user_id,status FROM esl_v2.members WHERE member_id=${Number(id)}
      ), changed AS (
        UPDATE esl_v2.members AS mb
        SET status=${status},
            approved_at=CASE WHEN ${status}='active' THEN COALESCE(mb.approved_at,now()) ELSE mb.approved_at END,
            approved_by_user_id=CASE WHEN ${status}='active' THEN ${actorId} ELSE mb.approved_by_user_id END,
            updated_at=now()
        FROM previous AS p
        WHERE mb.member_id=p.member_id AND mb.status=p.status AND p.status<>${status}
        RETURNING mb.member_id,mb.user_id,p.status AS old_status,mb.status AS new_status
      ), history AS (
        INSERT INTO esl_v2.member_status_history
          (member_id,changed_by_user_id,old_status,new_status,reason)
        SELECT member_id,${actorId},old_status,new_status,${reason} FROM changed
        RETURNING history_id,member_id
      ), audit AS (
        INSERT INTO esl_v2.audit_logs
          (actor_user_id,target_user_id,action,outcome,metadata)
        SELECT ${actorId},c.user_id,'member.status_changed','success',
          jsonb_build_object('member_id',c.member_id,'history_id',h.history_id,
                             'old_status',c.old_status,'new_status',c.new_status,'reason',${reason})
        FROM changed c JOIN history h ON h.member_id=c.member_id
        RETURNING audit_id
      )
      SELECT c.member_id, (SELECT count(*)::int FROM audit) AS audit_count
      FROM changed c`;
    if(!updated.length)return res.status(409).json({error:'대상 회원이 없거나 이미 동일한 상태입니다. 새로고침 후 확인하세요.'});
    if(updated[0].audit_count!==1)throw new Error('Audit log not inserted');
  }
  else if(type==='applications')updated=await sql`UPDATE esl_v2.meetup_applications SET status=${status},updated_at=now() WHERE application_id=${Number(id)} RETURNING application_id`;
  return res.status(updated.length?200:404).json({success:!!updated.length});
 }catch(e){console.error('admin-v2',e);return res.status(500).json({error:'서버 오류'});}
}
