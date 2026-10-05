const db = require('../config/db');

// All pipe sections, with the names of their upstream and downstream stations
async function getAllSections() {
    const [rows] = await db.query(
        `SELECT ps.*, us.name AS upstream_name, ds.name AS downstream_name
         FROM pipe_sections ps
         INNER JOIN sites us ON ps.upstream_site_id = us.id
         INNER JOIN sites ds ON ps.downstream_site_id = ds.id
         ORDER BY ps.id ASC`
    );
    return rows;
}

// All pipe sections that touch a given site (as upstream or downstream station)
async function getSectionsForSite(site_id) {
    const [rows] = await db.query(
        `SELECT * FROM pipe_sections
         WHERE upstream_site_id = ? OR downstream_site_id = ?`,
        [site_id, site_id]
    );
    return rows;
}

async function updateConditionStatus(id, condition_status) {
    await db.query(
        `UPDATE pipe_sections SET condition_status = ? WHERE id = ?`,
        [condition_status, id]
    );
}

module.exports = { getAllSections, getSectionsForSite, updateConditionStatus };