/**
 * Drizzle Kit configuration for the Test Material Warehouse MySQL database.
 *
 * Usage (run from the `server/` directory):
 *   npm run db:generate   -> generate SQL migration files from the schema
 *   npm run db:migrate    -> apply pending migrations to the database
 *   npm run db:push       -> push schema changes directly (dev fast-path)
 */
require('dotenv').config();

const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  dialect: 'mysql',
  schema: './db/schema.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
