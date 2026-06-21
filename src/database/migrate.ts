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

  console.log(`Connecting to MySQL at ${config.db.host}:${config.db.port} to ensure database exists...`);

  // Step 1: Attempt to create the database if permissions allow.
  // Connect without a specific database first.
  const initConnection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    console.log(`Ensuring database '${config.db.database}' exists...`);
    await initConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database '${config.db.database}' verified or created.`);
  } catch (error) {
    console.warn(
      `⚠️  Could not run CREATE DATABASE (this is expected if using a managed cloud database like Aiven or Railway with pre-allocated databases). Proceeding assuming database exists. Details: ${(error as Error).message}`
    );
  } finally {
    await initConnection.end();
  }

  // Step 2: Connect directly to the target database and apply schema.sql.
  console.log(`Connecting to MySQL database '${config.db.database}' to run table migrations...`);
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    console.log('Applying schema.sql tables...');
    await connection.query(schemaSql);
    console.log('✅ Migration complete. Database tables are ready.');
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
