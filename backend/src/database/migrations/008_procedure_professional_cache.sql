-- Migration 008: Cache de Procedimentos e Profissionais
-- Armazena dados agregados da Belle API para carregamento instantâneo

-- Tabela de cache de procedimentos mais vendidos
-- Agregados mensalmente para consulta rápida
CREATE TABLE IF NOT EXISTS procedimentos_cache (
  id SERIAL PRIMARY KEY,
  ano_mes VARCHAR(7) NOT NULL, -- formato: yyyy-MM
  nome VARCHAR(255) NOT NULL,
  quantidade INTEGER DEFAULT 0,
  valor DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ano_mes, nome)
);

-- Tabela de cache de profissionais com mais vendas
-- Agregados mensalmente para consulta rápida
CREATE TABLE IF NOT EXISTS profissionais_cache (
  id SERIAL PRIMARY KEY,
  ano_mes VARCHAR(7) NOT NULL, -- formato: yyyy-MM
  nome VARCHAR(255) NOT NULL,
  vendas INTEGER DEFAULT 0,
  valor DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ano_mes, nome)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_procedimentos_cache_ano_mes ON procedimentos_cache(ano_mes);
CREATE INDEX IF NOT EXISTS idx_procedimentos_cache_valor ON procedimentos_cache(valor DESC);
CREATE INDEX IF NOT EXISTS idx_profissionais_cache_ano_mes ON profissionais_cache(ano_mes);
CREATE INDEX IF NOT EXISTS idx_profissionais_cache_valor ON profissionais_cache(valor DESC);

-- Registro de quando foi feito o último sync do cache
CREATE TABLE IF NOT EXISTS cache_sync_status (
  id SERIAL PRIMARY KEY,
  cache_type VARCHAR(50) NOT NULL UNIQUE, -- 'procedimentos' ou 'profissionais'
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(20), -- 'success', 'error', 'running'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insere status inicial
INSERT INTO cache_sync_status (cache_type, last_sync_status)
VALUES ('procedimentos', 'pending'), ('profissionais', 'pending')
ON CONFLICT (cache_type) DO NOTHING;

-- Comentários
COMMENT ON TABLE procedimentos_cache IS 'Cache de procedimentos mais vendidos agregados mensalmente';
COMMENT ON TABLE profissionais_cache IS 'Cache de profissionais com mais vendas agregados mensalmente';
COMMENT ON TABLE cache_sync_status IS 'Status de sincronização do cache de procedimentos e profissionais';
