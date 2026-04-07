import * as dotenv from 'dotenv';
import { listStores } from './core/storeLoader';
import { logger } from './core/logger';

dotenv.config();

const stores = listStores();

if (stores.length === 0) {
  logger.warn('No stores found. Add a store folder under stores/ with .env and config.json.');
} else {
  logger.info(`${stores.length} store(s) configured: ${stores.join(', ')}`);
  logger.info('Use "npm run fetch -- <store> <command>" to pull data for analysis.');
  logger.info('Commands: orders | products | customers | analytics | themes | webhooks');
}
