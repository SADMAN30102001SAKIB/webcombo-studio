import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import config from './config/index.js';
import apiRoutes from './routes/api.routes.js';

function purgeDirectory(dir) {
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir);
    for (const file of entries) {
      if (file === '.gitkeep') continue;
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch {}
    }
  }
}

function purgeStaleFiles(dir, maxAgeMs = 30 * 60 * 1000) {
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  try {
    const entries = fs.readdirSync(dir);
    for (const file of entries) {
      if (file === '.gitkeep') continue;
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
        }
      } catch {}
    }
  } catch {}
}

purgeDirectory(config.uploadsDir);
purgeDirectory(config.downloadDir);

setInterval(() => {
  purgeStaleFiles(config.uploadsDir);
  purgeStaleFiles(config.downloadDir);
}, 10 * 60 * 1000).unref();

const app = new Hono();

app.route('/api', apiRoutes);

app.use('/downloads/*', serveStatic({
  root: config.downloadDir,
  rewriteRequestPath: (p) => p.replace(/^\/downloads/, '')
}));

app.use('/*', serveStatic({ root: './public' }));

app.onError((err, c) => {
  console.error('[App Error]', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
