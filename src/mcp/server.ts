/**
 * Shopify MCP Server — stdio mode (Claude Code CLI)
 *
 * For the HTTP/URL mode (Claude desktop app), see the /mcp endpoint in webhooks/server.ts.
 *
 * Register with Claude Code:
 *   claude mcp add shopify node "/path/to/dist/mcp/server.js" -e "STORES_DIR=/path/to/stores"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createShopifyMcpServer } from './tools';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const server = createShopifyMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`MCP server error: ${String(err)}\n`);
  process.exit(1);
});
