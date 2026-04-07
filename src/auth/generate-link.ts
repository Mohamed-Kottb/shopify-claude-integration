/**
 * Generate an OAuth install link for a client store.
 * Usage: ts-node src/auth/generate-link.ts storename.myshopify.com
 */
import * as dotenv from 'dotenv';
import { generateInstallLink } from './oauth';

dotenv.config();

const shop = process.argv[2];

if (!shop) {
  console.error('Usage: ts-node src/auth/generate-link.ts storename.myshopify.com');
  process.exit(1);
}

if (!shop.endsWith('.myshopify.com')) {
  console.error('Shop must end with .myshopify.com');
  process.exit(1);
}

const link = generateInstallLink(shop);
console.log('\n── Install link for', shop);
console.log(link);
console.log('\nSend this link to the store owner. They click it, authorize, and the store is added automatically.\n');
