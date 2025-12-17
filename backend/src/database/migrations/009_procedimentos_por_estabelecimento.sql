-- Migration 009: Adiciona estabelecimento ao cache de procedimentos
-- Permite consultar procedimentos por estabelecimento

-- Adiciona campo cod_estab à tabela procedimentos_cache
ALTER TABLE procedimentos_cache ADD COLUMN IF NOT EXISTS cod_estab INTEGER;
ALTER TABLE procedimentos_cache ADD COLUMN IF NOT EXISTS nome_estab VARCHAR(100);

-- Remove a constraint única antiga e cria uma nova incluindo estabelecimento
-- Primeiro remove a constraint antiga se existir
ALTER TABLE procedimentos_cache DROP CONSTRAINT IF EXISTS procedimentos_cache_ano_mes_nome_key;

-- Cria nova constraint única incluindo estabelecimento
-- Procedimentos são únicos por ano_mes + nome + cod_estab
ALTER TABLE procedimentos_cache ADD CONSTRAINT procedimentos_cache_ano_mes_nome_estab_key
  UNIQUE (ano_mes, nome, cod_estab);

-- Índice para busca por estabelecimento
CREATE INDEX IF NOT EXISTS idx_procedimentos_cache_estab ON procedimentos_cache(cod_estab);
CREATE INDEX IF NOT EXISTS idx_procedimentos_cache_ano_mes_estab ON procedimentos_cache(ano_mes, cod_estab);

-- Adiciona campo cod_estab à tabela profissionais_cache também
ALTER TABLE profissionais_cache ADD COLUMN IF NOT EXISTS cod_estab INTEGER;
ALTER TABLE profissionais_cache ADD COLUMN IF NOT EXISTS nome_estab VARCHAR(100);

-- Remove constraint antiga e cria nova
ALTER TABLE profissionais_cache DROP CONSTRAINT IF EXISTS profissionais_cache_ano_mes_nome_key;
ALTER TABLE profissionais_cache ADD CONSTRAINT profissionais_cache_ano_mes_nome_estab_key
  UNIQUE (ano_mes, nome, cod_estab);

-- Índice para busca por estabelecimento
CREATE INDEX IF NOT EXISTS idx_profissionais_cache_estab ON profissionais_cache(cod_estab);
CREATE INDEX IF NOT EXISTS idx_profissionais_cache_ano_mes_estab ON profissionais_cache(ano_mes, cod_estab);

-- Comentários
COMMENT ON COLUMN procedimentos_cache.cod_estab IS 'Código do estabelecimento Belle';
COMMENT ON COLUMN procedimentos_cache.nome_estab IS 'Nome do estabelecimento';
COMMENT ON COLUMN profissionais_cache.cod_estab IS 'Código do estabelecimento Belle';
COMMENT ON COLUMN profissionais_cache.nome_estab IS 'Nome do estabelecimento';
