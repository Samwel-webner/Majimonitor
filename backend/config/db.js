// MySQL connection pool
// Using a pool (not a single connection) so multiple requests
// can query the database concurrently without blocking each other.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'majimonitor',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Quick check on startup so connection issues fail loudly and early
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL connected successfully to database:', process.env.DB_NAME || 'majimonitor');
        connection.release();
    } catch (err) {
        console.error('❌ MySQL connection failed:', err.message);
        console.error('   Check your .env file and make sure MySQL is running.');
    }
}

testConnection();

module.exports = pool;
