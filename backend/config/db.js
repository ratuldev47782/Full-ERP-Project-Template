/**
 * backend/config/db.js
 *
 * The single MySQL connection of the project.
 * A mysql2 pool is created once and wrapped by Drizzle ORM, then reused by every
 * controller instead of opening a new connection per request.
 */

const mysql = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');

const schema = require('../models/model');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// mode: 'default' is required by Drizzle whenever a schema is supplied.
const db = drizzle(pool, { schema, mode: 'default' });

module.exports = { db, pool };
