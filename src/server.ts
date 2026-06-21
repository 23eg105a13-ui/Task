import { createApp } from './app';
import { config } from './config/env';
import { testConnection } from './config/database';

async function start(): Promise<void> {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn(
      '⚠️  Could not connect to MySQL on startup. The server will still start, ' +
        'but API calls that touch the database will fail until the connection ' +
        'is available. Check your .env DB_* settings.'
    );
  } else {
    console.log('✅ MySQL connection verified.');
  }

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`🚀 GitHub Profile Analyzer API running on port ${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
  });
}

start().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
