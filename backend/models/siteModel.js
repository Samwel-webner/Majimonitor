const db = require('../config/db');

// Get all sites, with assigned officer's name joined in
async function getAllSites() {
    const [rows] = await db.query(
        `SELECT s.*, u.name AS assigned_officer_name
         FROM sites s
         LEFT JOIN users u ON s.assigned_officer_id = u.id
         ORDER BY s.name ASC`
    );
    return rows;
}

async function getSiteById(id) {
    const [rows] = await db.query(
        `SELECT s.*, u.name AS assigned_officer_name
         FROM sites s
         LEFT JOIN users u ON s.assigned_officer_id = u.id
         WHERE s.id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function createSite(data) {
    const { name, location_description, latitude, longitude, river_section, assigned_officer_id, status } = data;
    const [result] = await db.query(
        `INSERT INTO sites (name, location_description, latitude, longitude, river_section, assigned_officer_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, location_description, latitude, longitude, river_section, assigned_officer_id || null, status || 'active']
    );
    return getSiteById(result.insertId);
}

async function updateSite(id, data) {
    const existing = await getSiteById(id);
    if (!existing) return null;

    const name = data.name !== undefined ? data.name : existing.name;
    const location_description = data.location_description !== undefined ? data.location_description : existing.location_description;
    const latitude = data.latitude !== undefined ? data.latitude : existing.latitude;
    const longitude = data.longitude !== undefined ? data.longitude : existing.longitude;
    const river_section = data.river_section !== undefined ? data.river_section : existing.river_section;
    const assigned_officer_id = data.assigned_officer_id !== undefined ? data.assigned_officer_id : existing.assigned_officer_id;
    const status = data.status !== undefined ? data.status : existing.status;

    await db.query(
        `UPDATE sites
         SET name = ?, location_description = ?, latitude = ?, longitude = ?,
             river_section = ?, assigned_officer_id = ?, status = ?
         WHERE id = ?`,
        [name, location_description, latitude, longitude, river_section, assigned_officer_id || null, status, id]
    );
    return getSiteById(id);
}

async function deleteSite(id) {
    await db.query('DELETE FROM sites WHERE id = ?', [id]);
    return { id, deleted: true };
}

module.exports = { getAllSites, getSiteById, createSite, updateSite, deleteSite };
