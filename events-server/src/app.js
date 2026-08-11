import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { config, missingDataCloudConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { EVENT_TYPES, CONTRACT_KEYS } from './collect/contract.js';
import { buildSpec } from './docs/openapi.js';
import collectRoutes from './collect/collect.routes.js';
import * as repo from './collect/events.repository.js';

export function createApp({ flusher = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // A política padrão do helmet bloqueia o CSS e o script da própria página do
  // Swagger, então ela é afrouxada só para 'self' quando o /docs está no ar.
  app.use(config.docsEnabled ? helmet({ contentSecurityPolicy: false }) : helmet());
  // Em dev o navegador chega pelo proxy do Vite (mesma origem) e a allowlist
  // fica vazia. Em produção o coletor está em outro domínio, e aí só as origens
  // declaradas passam — coletor aberto é convite para poluição de dados.
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : false,
      methods: ['POST'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: config.collect.maxBodyBytes }));

  // Liveness com o estado da FILA: processo vivo não quer dizer clique saindo.
  // O sintoma que interessa é fila pendente crescendo e nada sendo enviado.
  app.get('/health', async (_req, res) => {
    const base = {
      status: 'ok',
      service: 'techlar-events',
      ts: new Date().toISOString(),
      uptime: process.uptime(),
      mode: flusher?.mode || (config.flush.dryRun ? 'dry-run' : config.flush.validateOnly ? 'validate' : 'ingest'),
      db_configured: Boolean(config.databaseUrl),
      datacloud_missing: missingDataCloudConfig(),
      contract: { object: config.dataCloud.object, keys: CONTRACT_KEYS.length, event_types: EVENT_TYPES.length },
    };
    if (!config.databaseUrl) return res.json(base);
    try {
      const queue = await repo.queueStats();
      const oldest = queue.oldest_pending ? Date.now() - new Date(queue.oldest_pending).getTime() : 0;
      return res.json({ ...base, queue: { ...queue, oldest_pending_ms: oldest } });
    } catch (err) {
      // Sem banco o coletor não aceita clique, e o /health tem que dizer isso.
      return res.status(503).json({ ...base, status: 'degraded', error: err.message });
    }
  });

  // Swagger em /docs e a especificação crua em /openapi.json. O /docs manda um
  // POST de verdade, então ele é uma ferramenta de teste, não só leitura — e é
  // por isso que existe a chave para desligar (`EVENTS_DOCS=false`) quando o
  // coletor estiver recebendo tráfego real.
  if (config.docsEnabled) {
    const spec = buildSpec();
    app.get('/openapi.json', (_req, res) => res.json(spec));
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customSiteTitle: 'TechLar — Coletor de engajamento',
        swaggerOptions: { docExpansion: 'list', defaultModelsExpandDepth: 1, tryItOutEnabled: true },
      }),
    );
    // Serviço de uma rota só: quem abre a raiz está procurando a documentação.
    app.get('/', (_req, res) => res.redirect('/docs'));
  }

  app.use('/collect', collectRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
  });

  app.use((err, _req, res, _next) => {
    // Corpo acima do teto chega aqui como 413 do express.json.
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error('request.failed', { err: err.message });
    res.status(status).json({ error: status === 413 ? 'Lote grande demais.' : 'Erro no coletor de eventos.' });
  });

  return app;
}

export default createApp;
