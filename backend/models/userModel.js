const db = require('../config/db');

async function findUserByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
}


async function findUserById(id) {
    const [rows] = await db.query('SELECT id, name, email, role, gender, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}

async function getAllUsers() {
    const [rows] = await db.query('SELECT id, name, email, role, gender, created_at FROM users ORDER BY name ASC');
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

module.exports = { findUserByEmail, findUserById, createUser, getAllUsers, deleteUser, setResetToken, findUserByResetToken, updatePasswordAndClearToken, findUserByIdWithPassword };