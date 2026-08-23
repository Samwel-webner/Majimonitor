const db = require('../config/db');

async function createReading(site_id, parameter_id, value) {
    const [result] = await db.query(
        `INSERT INTO readings (site_id, parameter_id, value) VALUES (?, ?, ?)`,
        [site_id, parameter_id, value]
    );
    return getReadingById(result.insertId);
}

async function getReadingById(id) {
    const [rows] = await db.query('SELECT * FROM readings WHERE id = ?', [id]);
    return rows[0] || null;
}

// Latest reading per parameter for a given site (used on the site detail page)
async function getLatestReadingsForSite(site_id) {
    const [rows] = await db.query(
        `SELECT r.*, p.name AS parameter_name, p.unit, p.safe_min, p.safe_max, p.warning_min, p.warning_max
         FROM readings r
         INNER JOIN parameters p ON r.parameter_id = p.id
         INNER JOIN (
             SELECT parameter_id, MAX(recorded_at) AS max_time
             FROM readings
             WHERE site_id = ?
             GROUP BY parameter_id
         ) latest ON r.parameter_id = latest.parameter_id AND r.recorded_at = latest.max_time
         WHERE r.site_id = ?
         ORDER BY p.name ASC`,
        [site_id, site_id]
    );
    return rows;
}

// Historical readings for a site + parameter, for charting, within a date range
async function getHistoricalReadings(site_id, parameter_id, from, to) {
    const [rows] = await db.query(
        `SELECT value, recorded_at FROM readings
         WHERE site_id = ? AND parameter_id = ?
         AND recorded_at BETWEEN ? AND ?
         ORDER BY recorded_at ASC`,
        [site_id, parameter_id, from, to]
    );
    return rows;
}

async function getHistoricalReadings(site_id, parameter_id, from, to) {
    const [rows] = await db.query(
        `SELECT value, recorded_at FROM readings
         WHERE site_id = ? AND parameter_id = ?
         AND recorded_at BETWEEN ? AND ?
         ORDER BY recorded_at ASC`,
        [site_id, parameter_id, new Date(from), new Date(to)]
    );
    return rows;
}

async function getReadingsForExport(site_id, from, to) {
    const [rows] = await db.query(
        `SELECT r.recorded_at, p.name AS parameter_name, r.value, p.unit
         FROM readings r
         INNER JOIN parameters p ON r.parameter_id = p.id
         WHERE r.site_id = ? AND r.recorded_at BETWEEN ? AND ?
         ORDER BY r.recorded_at ASC`,
        [site_id, new Date(from), new Date(to)]
    );
    return rows;
}
module.exports = { createReading, getReadingById, getLatestReadingsForSite, getHistoricalReadings, getReadingsForExport };