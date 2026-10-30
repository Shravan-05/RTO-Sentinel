import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'rto-sentinel-api',
      timestamp: new Date().toISOString()
    });
  });

  // API routes (both /api/v1 and /api for backward and forward compatibility)
  app.use('/api/v1', routes);
  app.use('/api', routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
  });

  // Global Error handler
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, err.stack);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  });

  return app;
};

