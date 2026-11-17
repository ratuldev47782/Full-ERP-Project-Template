require('dotenv').config();

const { defineConfig } = require('drizzle-kit');

const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || 3306;
const database = process.env.DB_NAME || 'HKD_ERP_DB';

module.exports = defineConfig({
  schema: './models/model.js',
  dialect: 'mysql',
  dbCredentials: {
    url: `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  },
});