/**
 * Simple migration runner: reads database/schema.sql and executes it
 * against the configured MySQL server. Safe to re-run — all DDL uses
 * CREATE DATABASE/TABLE IF NOT EXISTS.
 *
 * Usage:
 *   npm run migrate        (compiled)
 *   npm run migrate:dev    (ts-node, no build step needed)
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config/env';

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log(`Connecting to MySQL at ${config.db.host}:${config.db.port} ...`);

  // Connect WITHOUT specifying a database first, since schema.sql
  // itself creates the database with CREATE DATABASE IF NOT EXISTS.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    console.log('Applying schema.sql ...');
    await connection.query(schemaSql);
    console.log('✅ Migration complete. Database and tables are ready.');
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
