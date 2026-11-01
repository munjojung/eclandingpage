
import { getDb } from './_lib/db.js';
import {
  getAdminIdentity,
  requireSameOrigin
} from './_lib/admin-session.js';

const choices = {
  meetups: [
    'draft',
    'scheduled',
    'closed',
    'cancelled',
    'completed'
  ],
  members: [
    'pending',
    'active',
    'suspended',
    'withdrawn'
  ],
  applications: [
    'applied',
    'approved',
    'rejected',
    'waitlisted'
  ]
};


// Explicit transition policy. Re-approval from rejected requires a documented reason.
const applicationTransitions = Object.freeze({
  applied: ['approved', 'rejected', 'waitlisted'],
  approved: ['waitlisted', 'rejected'],
  waitlisted: ['approved', 'rejected'],
  rejected: ['approved']
});

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  if (req.method === 'PATCH') {
    const error = requireSameOrigin(req);

    if (error) {
      return res.status(403).json({ error });
    }
  }

  try {
    // Existing administrator authentication
    const adminIdentity = await getAdminIdentity(req);
    if (!adminIdentity || !Number.isSafeInteger(adminIdentity.user_id) || adminIdentity.user_id <= 0) {
      return res.status(401).json({
        error: '관리자 로그인이 필요합니다.'
      });
    }

    // Development preview only
    if (
      process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'dev'
    ) {
      return res.status(403).json({
        error: 'dev Preview 전용입니다.'
      });
    }

    const sql = getDb();

    const type = req.method === 'GET'
      ? req.query.type
      : req.body?.type;

    // =========================================
    // GET: V2 data
    // =========================================
    if (req.method === 'GET') {
      let data;

      if (type === 'meetups') {
        data = await sql`
          SELECT
            meetup_id,
            meetup_code,
            title,
            to_char(meetup_date, 'YYYY-MM-DD') AS meetup_date,
            location,
            status
          FROM esl_v2.meetups
          ORDER BY meetup_date DESC
        `;

      } else if (type === 'groups') {
        data = await sql`
          SELECT
            g.group_id,
            m.meetup_code,
            g.group_no,
            u.real_name AS facilitator,
            (
              SELECT count(*)::int
              FROM esl_v2.meetup_assignments a
              WHERE a.group_id = g.group_id
            ) AS participants
          FROM esl_v2.meetup_groups g
          JOIN esl_v2.meetups m
            ON m.meetup_id = g.meetup_id
          LEFT JOIN esl_v2.users u
            ON u.user_id = g.facilitator_user_id
          ORDER BY m.meetup_date DESC, g.group_no
        `;

      } else if (type === 'member_history') {
        const memberId = Number(req.query.member_id);

        if (!Number.isSafeInteger(memberId) || memberId <= 0) {
          return res.status(400).json({
            error: '올바른 회원 ID가 필요합니다.'
          });
        }

        data = await sql`
          SELECT
            h.history_id,
            h.member_id,
            h.old_status,
            h.new_status,
            h.reason,
            h.changed_by_user_id,
            u.real_name AS changed_by_name,
            h.changed_at
          FROM esl_v2.member_status_history h
          LEFT JOIN esl_v2.users u ON u.user_id = h.changed_by_user_id
          WHERE h.member_id = ${memberId}::bigint
          ORDER BY h.changed_at DESC, h.history_id DESC
        `;

      } else if (type === 'audit_logs') {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const action = String(req.query.action || '').trim();
        const actor = String(req.query.actor_user_id || '').trim();
        if (action.length > 100 || (actor && !/^\d{1,15}$/.test(actor))) {
          return res.status(400).json({ error: '잘못된 감사 로그 검색 조건입니다.' });
        }
        const actorId = actor ? Number(actor) : null;
        data = await sql`
          SELECT audit_id, actor_user_id, target_user_id,
                 action, outcome, metadata, created_at
          FROM esl_v2.audit_logs
          WHERE (${action}::text = '' OR a.action = ${action}::text)
            AND (${actorId}::bigint IS NULL OR a.actor_user_id = ${actorId}::bigint)
          ORDER BY a.created_at DESC, a.audit_id DESC
          LIMIT ${limit}::int
        `;

      } else if (type === 'application_history') {
        const applicationId = Number(req.query.application_id);
        if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
          return res.status(400).json({ error: '올바른 신청 ID가 필요합니다.' });
        }
        data = await sql`
          SELECT h.history_id, h.application_id, h.old_status,
                 h.new_status, h.reason, h.changed_by_user_id,
                 h.changed_at, u.real_name AS changed_by_name
          FROM esl_v2.meetup_application_status_history h
          LEFT JOIN esl_v2.users u ON u.user_id = h.changed_by_user_id
          WHERE h.application_id = ${applicationId}::bigint
          ORDER BY h.changed_at DESC, h.history_id DESC
          LIMIT 100
        `;

      } else if (type === 'members') {
        data = await sql`
          SELECT
            mb.member_id,
            u.real_name,
            mb.nickname,
            mb.english_level,
            mb.status
          FROM esl_v2.members mb
          JOIN esl_v2.users u
            ON u.user_id = mb.user_id
          ORDER BY mb.member_id
        `;

      } else if (type === 'applications') {
        data = await sql`
          SELECT
            a.application_id,
            m.meetup_code,
            u.real_name,
            a.status
          FROM esl_v2.meetup_applications a
          JOIN esl_v2.meetups m
            ON m.meetup_id = a.meetup_id
          JOIN esl_v2.users u
            ON u.user_id = a.user_id
          ORDER BY a.application_id
        `;

      } else if (type === 'assignments') {
        data = await sql`
          SELECT
            a.assignment_id,
            m.meetup_code,
            g.group_no,
            u.real_name,
            a.role
          FROM esl_v2.meetup_assignments a
          JOIN esl_v2.meetup_groups g
            ON g.group_id = a.group_id
          JOIN esl_v2.meetups m
            ON m.meetup_id = a.meetup_id
          JOIN esl_v2.meetup_applications ap
            ON ap.application_id = a.application_id
          JOIN esl_v2.users u
            ON u.user_id = ap.user_id
          ORDER BY m.meetup_date DESC, g.group_no
        `;

      } else if (type === 'attendance') {
        data = await sql`
          SELECT
            t.assignment_id,
            m.meetup_code,
            u.real_name,
            t.status
          FROM esl_v2.attendance t
          JOIN esl_v2.meetup_assignments a
            ON a.assignment_id = t.assignment_id
          JOIN esl_v2.meetups m
            ON m.meetup_id = a.meetup_id
          JOIN esl_v2.meetup_applications ap
            ON ap.application_id = a.application_id
          JOIN esl_v2.users u
            ON u.user_id = ap.user_id
          ORDER BY m.meetup_date DESC
        `;

      } else {
        return res.status(400).json({
          error: 'Unknown type'
        });
      }

      return res.status(200).json({
        success: true,
        data
      });
    }

    // =========================================
    // PATCH: Validate status change
    // =========================================
    const { id, status } = req.body || {};
    const numericId = Number(id);

    if (
      !Number.isSafeInteger(numericId) ||
      numericId <= 0 ||
      !choices[type]?.includes(status)
    ) {
      return res.status(400).json({
        error: '잘못된 요청'
      });
    }

    let updated;

    // =========================================
    // PATCH: Meetup status
    // =========================================
    if (type === 'meetups') {
      updated = await sql`
        UPDATE esl_v2.meetups
        SET
          status = ${status}::text,
          updated_at = now()
        WHERE meetup_id = ${numericId}::bigint
        RETURNING meetup_id
      `;

    // =========================================
    // PATCH: Member status with audit history
    // =========================================
    } else if (type === 'members') {
      const actorId = adminIdentity.user_id;

      if (
        !Number.isSafeInteger(actorId) ||
        actorId <= 0
      ) {
        return res.status(503).json({
          error: '개인별 관리자 세션이 필요합니다.'
        });
      }

      const actor = await sql`
        SELECT user_id
        FROM esl_v2.users
        WHERE user_id = ${actorId}::bigint
          AND account_status = 'active'
        LIMIT 1
      `;

      if (!actor.length) {
        return res.status(403).json({
          error: '활성 관리자 계정을 찾을 수 없습니다.'
        });
      }

      const reason =
        typeof req.body?.reason === 'string'
          ? req.body.reason.trim()
          : '';

      if (!reason || reason.length > 500) {
        return res.status(400).json({
          error: '회원 상태 변경 사유를 1~500자로 입력하세요.'
        });
      }

      // Atomic SQL statement:
      // 1. Update member status
      // 2. Insert status history
      // 3. Insert audit log
      //
      // Explicit parameter casts prevent
      // PostgreSQL error 42P18.
      //
      // No-op changes do not create history.

      updated = await sql`
        WITH previous AS MATERIALIZED (
          SELECT
            member_id,
            user_id,
            status
          FROM esl_v2.members
          WHERE member_id = ${numericId}::bigint
        ),

        changed AS (
          UPDATE esl_v2.members AS mb
          SET
            status = ${status}::text,

            approved_at = CASE
              WHEN ${status}::text = 'active'
              THEN COALESCE(
                mb.approved_at,
                now()
              )
              ELSE mb.approved_at
            END,

            approved_by_user_id = CASE
              WHEN ${status}::text = 'active'
              THEN ${actorId}::bigint
              ELSE mb.approved_by_user_id
            END,

            updated_at = now()

          FROM previous AS p

          WHERE mb.member_id = p.member_id
            AND mb.status = p.status
            AND p.status <> ${status}::text

          RETURNING
            mb.member_id,
            mb.user_id,
            p.status AS old_status,
            mb.status AS new_status
        ),

        history AS (
          INSERT INTO esl_v2.member_status_history (
            member_id,
            changed_by_user_id,
            old_status,
            new_status,
            reason
          )
          SELECT
            member_id,
            ${actorId}::bigint,
            old_status,
            new_status,
            ${reason}::text
          FROM changed

          RETURNING
            history_id,
            member_id
        ),

        audit AS (
          INSERT INTO esl_v2.audit_logs (
            actor_user_id,
            target_user_id,
            action,
            outcome,
            metadata
          )
          SELECT
            ${actorId}::bigint,
            c.user_id,
            'member.status_changed',
            'success',

            jsonb_build_object(
              'member_id', c.member_id,
              'history_id', h.history_id,
              'old_status', c.old_status,
              'new_status', c.new_status,
              'reason', ${reason}::text
            )

          FROM changed c
          JOIN history h
            ON h.member_id = c.member_id

          RETURNING audit_id
        )

        SELECT
          c.member_id,
          (
            SELECT count(*)::int
            FROM audit
          ) AS audit_count

        FROM changed c
      `;

      if (!updated.length) {
        return res.status(409).json({
          error: '대상 회원이 없거나 이미 동일한 상태입니다. 새로고침 후 확인하세요.'
        });
      }

      if (updated[0].audit_count !== 1) {
        throw new Error(
          'Audit log not inserted'
        );
      }

    // =========================================
    // PATCH: Application status
    // =========================================
    } else if (type === 'applications') {
      const actorId = adminIdentity.user_id;
      if (!Number.isSafeInteger(actorId) || actorId <= 0) {
        return res.status(503).json({
          error: '개인별 관리자 세션이 필요합니다.'
        });
      }

      const reason = typeof req.body?.reason === 'string'
        ? req.body.reason.trim() : '';
      if (!reason || reason.length > 500) {
        return res.status(400).json({
          error: '신청 상태 변경 사유를 1~500자로 입력하세요.'
        });
      }

      const existing = await sql`
        SELECT status FROM esl_v2.meetup_applications
        WHERE application_id = ${numericId}::bigint
      `;
      if (!existing.length) {
        return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
      }
      const previousStatus = existing[0].status;
      if (!applicationTransitions[previousStatus]?.includes(status)) {
        return res.status(409).json({
          error: `허용되지 않는 상태 변경입니다: ${previousStatus} → ${status}`
        });
      }
      if (previousStatus === 'rejected' && status === 'approved' && reason.length < 10) {
        return res.status(400).json({ error: '거절 후 재승인에는 10자 이상의 구체적인 사유가 필요합니다.' });
      }

      const actor = await sql`
        SELECT user_id FROM esl_v2.users
        WHERE user_id = ${actorId}::bigint
          AND account_status = 'active'
        LIMIT 1
      `;
      if (!actor.length) {
        return res.status(403).json({
          error: '활성 관리자 계정을 찾을 수 없습니다.'
        });
      }

      // One SQL statement: status update + history + audit.
      // Unchanged statuses produce no history/audit rows.
      updated = await sql`
        WITH previous AS MATERIALIZED (
          SELECT application_id, user_id, status
          FROM esl_v2.meetup_applications
          WHERE application_id = ${numericId}::bigint
        ),
        changed AS (
          UPDATE esl_v2.meetup_applications AS a
          SET status = ${status}::text,
              reviewed_by_user_id = ${actorId}::bigint,
              reviewed_at = now(),
              updated_at = now()
          FROM previous AS p
          WHERE a.application_id = p.application_id
            AND a.status = p.status
            AND p.status = ${previousStatus}::text
            AND p.status <> ${status}::text
          RETURNING a.application_id, a.user_id,
                    p.status AS old_status, a.status AS new_status
        ),
        history AS (
          INSERT INTO esl_v2.meetup_application_status_history (
            application_id, changed_by_user_id,
            old_status, new_status, reason
          )
          SELECT application_id, ${actorId}::bigint,
                 old_status, new_status, ${reason}::text
          FROM changed
          RETURNING history_id, application_id
        ),
        audit AS (
          INSERT INTO esl_v2.audit_logs (
            actor_user_id, target_user_id, action, outcome, metadata
          )
          SELECT ${actorId}::bigint, c.user_id,
                 'application.status_changed', 'success',
                 jsonb_build_object(
                   'application_id', c.application_id,
                   'history_id', h.history_id,
                   'old_status', c.old_status,
                   'new_status', c.new_status,
                   'reason', ${reason}::text
                 )
          FROM changed c
          JOIN history h ON h.application_id = c.application_id
          RETURNING audit_id
        )
        SELECT c.application_id,
               (SELECT count(*)::int FROM history) AS history_count,
               (SELECT count(*)::int FROM audit) AS audit_count
        FROM changed c
      `;

      if (!updated.length) {
        return res.status(409).json({
          error: '상태가 다른 관리자에 의해 변경되었거나 동일 상태입니다. 새로고침 후 다시 확인하세요.'
        });
      }
      if (updated[0].history_count !== 1 || updated[0].audit_count !== 1) {
        throw new Error('Application history/audit insertion failed');
      }
    }

    return res.status(
      updated.length ? 200 : 404
    ).json({
      success: !!updated.length
    });

  } catch (e) {
    console.error('admin-mgt-v2', e);

    return res.status(500).json({
      error: '서버 오류'
    });
  }
}
