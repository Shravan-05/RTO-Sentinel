import { createApp } from './app.js';
import { config } from './config/index.js';
import { storage } from './services/storage.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  try {
    logger.info('Starting RTO Sentinel API Server...');
    
    // Initialize storage engine and seed data
    await storage.init();

    const app = createApp();

    app.listen(config.port, () => {
      logger.info(`=======================================================`);
      logger.info(`RTO Sentinel API Server active on http://localhost:${config.port}`);
      logger.info(`Storage Mode: ${storage.mode} (${storage.db.orders?.length || 0} orders loaded)`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`=======================================================`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`, err.stack);
    process.exit(1);
  }
}

bootstrap();

