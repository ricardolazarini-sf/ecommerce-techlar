import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { optionalAuth } from './middleware/auth.middleware.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

import catalogRoutes from './catalog/catalog.routes.js';
import cartRoutes from './cart/cart.routes.js';
import checkoutRoutes from './checkout/checkout.routes.js';
import ordersRoutes from './orders/orders.routes.js';
import wishlistRoutes from './wishlist/wishlist.routes.js';
import { authRouter, customersRouter } from './customers/customers.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // CSP disabled so the SPA can load remote product images and inline assets.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // Health check — deliberately independent of the database.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'techlar-server', ts: new Date().toISOString(), uptime: process.uptime() });
  });

  // Attach req.user when a valid token is present (anonymous otherwise).
  app.use('/api', optionalAuth);

  app.use('/api/catalog', catalogRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);

  // Unmatched API routes -> JSON 404.
  app.use('/api', notFound);

  // In production, serve the built SPA and let client-side routing handle the
  // rest. In development the client runs on the Vite dev server (port 5173).
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        service: 'techlar-server',
        message: 'API is running. Start the client dev server (npm run dev:client) or build it (npm run build).',
        health: '/health',
      });
    });
  }

  app.use(errorHandler);
  return app;
}

export default createApp;
