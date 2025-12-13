import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // PostgreSQL Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'bi_crepaldi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    poolSize: parseInt(process.env.DB_POOL_SIZE) || 10,
  },

  // Sincronização
  sync: {
    enabled: process.env.SYNC_ENABLED !== 'false',
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 5,
    retryAttempts: parseInt(process.env.SYNC_RETRY_ATTEMPTS) || 3,
    retryDelayMs: parseInt(process.env.SYNC_RETRY_DELAY_MS) || 5000,
  },

  bitrix24: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL,
    domain: process.env.BITRIX24_DOMAIN,
  },

  belle: {
    apiUrl: process.env.BELLE_API_URL || 'https://belle.bellesoftware.com.br/api',
    token: process.env.BELLE_API_TOKEN,
    estabelecimentos: (process.env.BELLE_ESTABELECIMENTOS || '1,2,5,10,11,12,14').split(',').map(Number),
    // Mapeamento de estabelecimentos
    estabelecimentosMap: {
      1: 'Dermato',
      2: 'SPA',
      5: 'Convênio',
      10: 'Drips',
      11: 'Estética',
      12: 'Bela Laser',
      14: 'Nutrologia',
    },
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300,
  },

  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};

export default config;
