const db = require('../config/db');

async function findUserByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
}


async function findUserById(id) {
    const [rows] = await db.query('SELECT id, name, email, role, gender, avatar, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}

async function getAllUsers() {
    const [rows] = await db.query('SELECT id, name, email, role, gender, avatar, created_at FROM users ORDER BY name ASC');
    return rows;
}

async function createUser({ name, email, password_hash, role, gender }) {
    const [result] = await db.query(
        `INSERT INTO users (name, email, password_hash, role, gender) VALUES (?, ?, ?, ?, ?)`,
        [name, email, password_hash, role || 'field_officer', gender || 'unspecified']
    );
    return findUserById(result.insertId);
}



async function deleteUser(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    return { id, deleted: true };
}

async function setResetToken(email, token, expires) {
    await db.query(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
        [token, expires, email]
    );
}

async function findUserByResetToken(token) {
    const [rows] = await db.query(
        'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
        [token]
    );
    return rows[0] || null;
}

async function updatePasswordAndClearToken(id, password_hash) {
    await db.query(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [password_hash, id]
    );
}

async function findUserByIdWithPassword(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}

async function savePushToken(userId, pushToken) {
    await db.query('UPDATE users SET push_token = ? WHERE id = ?', [pushToken, userId]);
    return { success: true };
}

async function updateAvatar(userId, avatar) {
    await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
    return { success: true };
}

async function getAdminPushTokens() {
    const [rows] = await db.query(
        `SELECT push_token FROM users WHERE role = 'admin' AND push_token IS NOT NULL`
    );
    return rows.map(r => r.push_token);
}

async function getOfficersSummary() {
    const num = (v) => Number(v) || 0; // MySQL returns SUM() as a string

    const [users] = await db.query(
        `SELECT id, name, email, role, gender, avatar
         FROM users WHERE role IN ('field_officer', 'admin') ORDER BY name ASC`
    );

    const [siteRows] = await db.query(
        `SELECT s.id, s.name, s.river_section, s.status, s.assigned_officer_id,
                COALESCE(SUM(a.status = 'active'), 0) AS active_alerts,
                COALESCE(SUM(a.status = 'acknowledged'), 0) AS checking_alerts,
                COALESCE(SUM(a.severity = 'critical'), 0) AS critical_open
         FROM sites s
         LEFT JOIN alerts a ON a.site_id = s.id AND a.status IN ('active', 'acknowledged')
         GROUP BY s.id, s.name, s.river_section, s.status, s.assigned_officer_id
         ORDER BY s.name ASC`
    );

    const [ackRows] = await db.query(
        `SELECT acknowledged_by AS user_id, COUNT(*) AS total, MAX(acknowledged_at) AS last_at
         FROM alerts WHERE acknowledged_by IS NOT NULL GROUP BY acknowledged_by`
    );

    const [resolvedRows] = await db.query(
        `SELECT resolved_by AS user_id, COUNT(*) AS total, MAX(resolved_at) AS last_at
         FROM alerts WHERE resolved_by IS NOT NULL GROUP BY resolved_by`
    );

    const [activityRows] = await db.query(
        `(SELECT 'acknowledged' AS action, a.acknowledged_at AS happened_at, a.acknowledged_by AS user_id,
                 a.id AS alert_id, s.name AS site_name, p.name AS parameter_name
          FROM alerts a
          INNER JOIN sites s ON a.site_id = s.id
          INNER JOIN parameters p ON a.parameter_id = p.id
          WHERE a.acknowledged_by IS NOT NULL AND a.acknowledged_at IS NOT NULL)
         UNION ALL
         (SELECT 'resolved', a.resolved_at, a.resolved_by, a.id, s.name, p.name
          FROM alerts a
          INNER JOIN sites s ON a.site_id = s.id
          INNER JOIN parameters p ON a.parameter_id = p.id
          WHERE a.resolved_by IS NOT NULL AND a.resolved_at IS NOT NULL)
         ORDER BY happened_at DESC
         LIMIT 15`
    );

    const sites = siteRows.map((s) => ({
        id: s.id,
        name: s.name,
        river_section: s.river_section,
        status: s.status,
        assigned_officer_id: s.assigned_officer_id,
        active_alerts: num(s.active_alerts),
        checking_alerts: num(s.checking_alerts),
        critical_open: num(s.critical_open),
    }));

    const acknowledged = new Map(ackRows.map((r) => [r.user_id, r]));
    const resolved = new Map(resolvedRows.map((r) => [r.user_id, r]));
    const sum = (list, field) => list.reduce((total, item) => total + item[field], 0);
    const newest = (a, b) => {
        if (!a) return b || null;
        if (!b) return a;
        return new Date(a) > new Date(b) ? a : b;
    };

    const officers = users.map((u) => {
        const mine = sites.filter((s) => s.assigned_officer_id === u.id);
        const ack = acknowledged.get(u.id);
        const done = resolved.get(u.id);
        return {
            ...u,
            acknowledged_total: ack ? num(ack.total) : 0,
            resolved_total: done ? num(done.total) : 0,
            last_activity: newest(ack && ack.last_at, done && done.last_at),
            sites: mine,
            open_unclaimed: sum(mine, 'active_alerts'),
            open_checking: sum(mine, 'checking_alerts'),
        };
    });

    const unassigned = sites.filter((s) => s.assigned_officer_id === null);
    const byId = new Map(users.map((u) => [u.id, u]));
    const recent_activity = activityRows.map((e) => {
        const who = byId.get(e.user_id);
        return { ...e, user_name: who ? who.name : 'Unknown', user_avatar: who ? who.avatar : null };
    });

    return {
        totals: {
            officers: users.length,
            unclaimed_alerts: sum(sites, 'active_alerts'),
            being_checked: sum(sites, 'checking_alerts'),
            unassigned_sites: unassigned.length,
        },
        officers,
        unassigned_sites: unassigned,
        recent_activity,
    };
}
module.exports = { findUserByEmail, findUserById, createUser, getAllUsers, deleteUser, setResetToken, findUserByResetToken, updatePasswordAndClearToken, findUserByIdWithPassword, savePushToken, updateAvatar, getAdminPushTokens, getOfficersSummary };