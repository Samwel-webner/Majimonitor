const db = require('../config/db');

async function getAllFilters() {
    const [rows] = await db.query(
        `SELECT f.*, s.name AS site_name
         FROM filters f
         INNER JOIN sites s ON f.site_id = s.id
         ORDER BY f.last_serviced_date ASC`
    );
    return rows;
}

async function createFilter({ site_id, filter_type, installation_date, last_serviced_date, service_interval_days, notes }) {
    const [result] = await db.query(
        `INSERT INTO filters (site_id, filter_type, installation_date, last_serviced_date, service_interval_days, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [site_id, filter_type, installation_date, last_serviced_date, service_interval_days || 90, notes || null]
    );
    return getFilterById(result.insertId);
}

async function getFilterById(id) {
    const [rows] = await db.query(
        `SELECT f.*, s.name AS site_name
         FROM filters f
         INNER JOIN sites s ON f.site_id = s.id
         WHERE f.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function markServiced(id) {
    await db.query('UPDATE filters SET last_serviced_date = CURDATE() WHERE id = ?', [id]);
    return getFilterById(id);
}

async function deleteFilter(id) {
    await db.query('DELETE FROM filters WHERE id = ?', [id]);
    return { id, deleted: true };
}

module.exports = { getAllFilters, createFilter, getFilterById, markServiced, deleteFilter };