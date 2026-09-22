import { serve } from '@hono/node-server';
import app from './src/app.js';
import config from './src/config/index.js';

const server = serve({
  fetch: app.fetch,
  port: config.port
}, () => {
  console.log(`\n======================================================`);
  console.log(`🎵 VocalRemover Studio is running on Hono!`);
  console.log(`🌐 Local Web UI: http://localhost:${config.port}`);
  console.log(`📁 Downloads Dir: ${config.downloadDir}`);
  console.log(`======================================================\n`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
