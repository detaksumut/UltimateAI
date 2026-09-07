/**
 * server.mjs
 * Primary Backend Entry Point for UltimateAI / JIN.
 * Boots the unified Local Router Service on port 20200.
 */

import { fileURLToPath } from 'url';
import { createLocalRouterServer } from './local_router/LocalRouterServer.mjs';
import { config, LOCAL_ROUTER_HEALTH_PATH } from './config/env.mjs';

const PORT = config.localRouter.port || 20200;

export const server = createLocalRouterServer();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`=======================================================`);
    console.log(`  ULTIMATEAI LOCAL ROUTER BACKEND LIVE ON PORT ${PORT} `);
    console.log(`  - Dashboard:   http://127.0.0.1:${PORT}/dashboard/connections`);
    console.log(`  - Health:      http://127.0.0.1:${PORT}${LOCAL_ROUTER_HEALTH_PATH}`);
    console.log(`  - Quota SSOT:  http://127.0.0.1:${PORT}/api/quota`);
    console.log(`  - Chat API:    http://127.0.0.1:${PORT}/v1/chat/completions`);
    console.log(`=======================================================`);
  });
}

export default server;
