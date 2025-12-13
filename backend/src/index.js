import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler, requestTimer } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import db from './database/index.js';
import syncService from './services/sync.service.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request timing - logs duration of all API calls
app.use(requestTimer);

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

async function startServer() {
  try {
    // Verifica conexão com o banco de dados
    const dbHealth = await db.healthCheck();
    if (dbHealth.connected) {
      logger.info(`PostgreSQL conectado: ${dbHealth.message}`);
    } else {
      logger.warn(`PostgreSQL não disponível: ${dbHealth.message}`);
      logger.warn('O servidor iniciará sem sincronização automática');
    }

    // Inicia o servidor HTTP
    app.listen(PORT, () => {
      logger.info(`BI Crepaldi Backend rodando na porta ${PORT}`);
      logger.info(`Ambiente: ${config.nodeEnv}`);

      // Inicia sincronização automática se banco estiver disponível
      if (dbHealth.connected && config.sync.enabled) {
        syncService.start();
        logger.info(`Sincronização automática ativada (a cada ${config.sync.intervalMinutes} minutos)`);
      }

      console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║   BI CREPALDI - Backend API                               ║
  ╠═══════════════════════════════════════════════════════════╣
  ║   Porta: ${String(PORT).padEnd(48)}║
  ║   Ambiente: ${config.nodeEnv.padEnd(45)}║
  ║   PostgreSQL: ${(dbHealth.connected ? '✅ Conectado' : '❌ Offline').padEnd(43)}║
  ║   Sync: ${(config.sync.enabled && dbHealth.connected ? `✅ A cada ${config.sync.intervalMinutes} min` : '❌ Desativado').padEnd(49)}║
  ╚═══════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, encerrando...');
  syncService.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recebido, encerrando...');
  syncService.stop();
  await db.close();
  process.exit(0);
});

startServer();

export default app;
