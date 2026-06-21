import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import profileRoutes from './routes/profileRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // --- Security & general middleware -----------------------------------
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // --- Rate limiting (protects both our service and the GitHub API
  //     quota from being exhausted by bursty/abusive traffic) ----------
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests. Please slow down and try again shortly.',
    },
  });
  app.use('/api', limiter);

  // --- Routes -------------------------------------------------------------
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'GitHub Profile Analyzer API',
      docs: {
        health: 'GET /health',
        analyze: 'POST /api/profiles/analyze  { "username": "octocat" }',
        listProfiles: 'GET /api/profiles?page=1&limit=10&sortBy=followers_count&order=DESC',
        getProfile: 'GET /api/profiles/:username',
        deleteProfile: 'DELETE /api/profiles/:username',
        statsSummary: 'GET /api/profiles/stats/summary',
      },
    });
  });

  app.use('/health', healthRoutes);
  app.use('/api/profiles', profileRoutes);

  // --- 404 + error handling (must be last) --------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
