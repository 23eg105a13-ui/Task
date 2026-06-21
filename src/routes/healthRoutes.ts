import { Router, Request, Response } from 'express';
import { testConnection } from '../config/database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbConnected = await testConnection();

  res.status(200).json({
    success: true,
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
  });
});

export default router;
