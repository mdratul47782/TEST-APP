/**
 * Drizzle MySQL connection (mysql2 driver + connection pool).
 */
const mysql = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');
const schema = require('../db/schema');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not defined. Copy server/.env.example to server/.env and fill in the values.'
  );
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
});

const db = drizzle(pool, { schema, mode: 'default' });

module.exports = { db, pool };
