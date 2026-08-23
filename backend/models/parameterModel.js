const db = require('../config/db');

async function getAllParameters() {
    const [rows] = await db.query('SELECT * FROM parameters ORDER BY name ASC');
    return rows;
}

async function getParameterById(id) {
    const [rows] = await db.query('SELECT * FROM parameters WHERE id = ?', [id]);
    return rows[0] || null;
}

// Works out which zone a value falls into for a given parameter.
// Used by both the alert engine and the frontend status badges.
function classifyValue(parameter, value) {
    const v = Number(value);
    if (v >= parameter.safe_min && v <= parameter.safe_max) {
        return 'safe';
    }
    if (v >= parameter.warning_min && v <= parameter.warning_max) {
        return 'warning';
    }
    return 'critical';
}

module.exports = { getAllParameters, getParameterById, classifyValue };
