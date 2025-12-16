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
    apiUrl: process.env.BELLE_API_URL || 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0',
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

  // Configuração de Metas por Estabelecimento
  metas: {
    // Meta SPA: SPA (2) + Estética (11) + Dermato (1) apenas DRA KELLY DA CAS
    spa: {
      nome: 'SPA',
      codestabs: [2, 11], // SPA e Estética (Dermato é filtrado por profissional)
      dermatoCodestab: 1, // Dermato - apenas DRA KELLY DA CAS
      dermatoProfissional: 'DRA KELLY DA CAS',
      metas: {
        meta1: 700000,
        meta2: 780000,
        meta3: 850000,
      },
    },
    // Meta Convênios: Convênio (5)
    convenios: {
      nome: 'Convênios',
      codestabs: [5],
      metas: {
        meta1: 121000,
        meta2: 136000,
        meta3: 151000,
      },
    },
    // Meta Bela Laser: Bela Laser (12)
    belaLaser: {
      nome: 'Bela Laser',
      codestabs: [12],
      metas: {
        meta1: 100000,
        meta2: 124000,
        meta3: 150000,
      },
    },
    // Meta Nutrologia: Nutrologia (14)
    nutrologia: {
      nome: 'Nutrologia',
      codestabs: [14],
      metas: {
        meta1: 257000,
        meta2: 294000,
        meta3: 331000,
      },
    },
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300,
  },

  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // JWT Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'bi-crepaldi-dev-secret-change-in-production-2024',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
};

export default config;
