const db = require('../config/db');

async function createAlert({ reading_id, site_id, parameter_id, triggered_value, severity, diagnosis = null }) {
    const [result] = await db.query(
        `INSERT INTO alerts (reading_id, site_id, parameter_id, triggered_value, severity, diagnosis, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [reading_id, site_id, parameter_id, triggered_value, severity, diagnosis]
    );
    return getAlertById(result.insertId);
}

async function getAlertById(id) {
    const [rows] = await db.query(
        `SELECT a.*, s.name AS site_name, p.name AS parameter_name, p.unit,
                ack.name AS acknowledged_by_name, ack.avatar AS acknowledged_by_avatar,
                res.name AS resolved_by_name, res.avatar AS resolved_by_avatar
         FROM alerts a
         INNER JOIN sites s ON a.site_id = s.id
         INNER JOIN parameters p ON a.parameter_id = p.id
         LEFT JOIN users ack ON a.acknowledged_by = ack.id
         LEFT JOIN users res ON a.resolved_by = res.id
         WHERE a.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function getAllAlerts(status) {
    let query = `SELECT a.*, s.name AS site_name, p.name AS parameter_name, p.unit,
                        ack.name AS acknowledged_by_name, ack.avatar AS acknowledged_by_avatar,
                        res.name AS resolved_by_name, res.avatar AS resolved_by_avatar
                 FROM alerts a
                 INNER JOIN sites s ON a.site_id = s.id
                 INNER JOIN parameters p ON a.parameter_id = p.id
                 LEFT JOIN users ack ON a.acknowledged_by = ack.id
                 LEFT JOIN users res ON a.resolved_by = res.id`;
    const params = [];
    if (status) {
        // One status ("active") or several separated by commas ("active,acknowledged")
        const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
        if (statuses.length) {
            query += ` WHERE a.status IN (${statuses.map(() => '?').join(', ')})`;
            params.push(...statuses);
        }
    }
    query += ' ORDER BY a.created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
}

// 'acknowledged' records who is checking it; 'resolved' records who closed it
// and keeps the acknowledger; 'active' (re-opened) clears both.
async function updateAlertStatus(id, status, userId = null) {
    if (status === 'acknowledged') {
        await db.query(
            `UPDATE alerts
             SET status = ?, acknowledged_by = ?, acknowledged_at = ?, resolved_at = NULL, resolved_by = NULL
             WHERE id = ?`,
            [status, userId, new Date(), id]
        );
    } else if (status === 'resolved') {
        await db.query(
            `UPDATE alerts SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
            [status, new Date(), userId, id]
        );
    } else {
        await db.query(
            `UPDATE alerts
             SET status = ?, acknowledged_by = NULL, acknowledged_at = NULL,
                 resolved_at = NULL, resolved_by = NULL
             WHERE id = ?`,
            [status, id]
        );
    }
    return getAlertById(id);
}

async function getAlertsForExport(from, to) {
    const [rows] = await db.query(
        `SELECT a.created_at, s.name AS site_name, p.name AS parameter_name,
                a.triggered_value, p.unit, a.severity, a.status, a.resolved_at
         FROM alerts a
         INNER JOIN sites s ON a.site_id = s.id
         INNER JOIN parameters p ON a.parameter_id = p.id
         WHERE a.created_at BETWEEN ? AND ?
         ORDER BY a.created_at ASC`,
        [new Date(from), new Date(to)]
    );
    return rows;
}

module.exports = { createAlert, getAlertById, getAllAlerts, updateAlertStatus, getAlertsForExport };