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
        `SELECT a.*, s.name AS site_name, p.name AS parameter_name, p.unit
         FROM alerts a
         INNER JOIN sites s ON a.site_id = s.id
         INNER JOIN parameters p ON a.parameter_id = p.id
         WHERE a.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function getAllAlerts(status) {
    let query = `SELECT a.*, s.name AS site_name, p.name AS parameter_name, p.unit
                 FROM alerts a
                 INNER JOIN sites s ON a.site_id = s.id
                 INNER JOIN parameters p ON a.parameter_id = p.id`;
    const params = [];
    if (status) {
        query += ' WHERE a.status = ?';
        params.push(status);
    }
    query += ' ORDER BY a.created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
}

async function updateAlertStatus(id, status, resolved_by = null) {
    const resolved_at = (status === 'resolved') ? new Date() : null;
    await db.query(
        `UPDATE alerts SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
        [status, resolved_at, resolved_by, id]
    );
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