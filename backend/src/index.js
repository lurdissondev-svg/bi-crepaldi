import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
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

app.listen(PORT, () => {
  logger.info(`BI Crepaldi Backend rodando na porta ${PORT}`);
  logger.info(`Ambiente: ${config.nodeEnv}`);
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   BI CREPALDI - Backend API               ║
  ║   Porta: ${PORT}                              ║
  ║   Ambiente: ${config.nodeEnv.padEnd(28)}║
  ╚═══════════════════════════════════════════╝
  `);
});

export default app;
