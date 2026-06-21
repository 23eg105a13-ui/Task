import mysql from 'mysql2/promise';
import { config } from './env';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: false,
});

/**
 * Quick connectivity check, used on server startup and by the
 * /health endpoint so deployment platforms can verify readiness.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection test failed:', error);
    return false;
  }
}
