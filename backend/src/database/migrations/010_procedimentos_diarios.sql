-- Migration 010: Tabela de Procedimentos Diários
-- Armazena procedimentos com data específica para consultas de período curto
-- O sync diário (últimos 7 dias) popula esta tabela para evitar chamadas à API

-- Tabela de procedimentos diários (dados granulares por data)
CREATE TABLE IF NOT EXISTS procedimentos_diarios (
  id SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  cod_estab INTEGER NOT NULL,
  nome_estab VARCHAR(100),
  nome_proc VARCHAR(255) NOT NULL,
  quantidade INTEGER DEFAULT 0,
  valor DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_ref, cod_estab, nome_proc)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_proced_diarios_data ON procedimentos_diarios(data_ref);
CREATE INDEX IF NOT EXISTS idx_proced_diarios_estab ON procedimentos_diarios(cod_estab);
CREATE INDEX IF NOT EXISTS idx_proced_diarios_data_estab ON procedimentos_diarios(data_ref, cod_estab);
CREATE INDEX IF NOT EXISTS idx_proced_diarios_valor ON procedimentos_diarios(valor DESC);

-- Adiciona status de sync para procedimentos diários
INSERT INTO cache_sync_status (cache_type, last_sync_status)
VALUES ('procedimentos_diarios', 'pending')
ON CONFLICT (cache_type) DO NOTHING;

-- Comentários
COMMENT ON TABLE procedimentos_diarios IS 'Procedimentos por data específica para filtros de período curto';
COMMENT ON COLUMN procedimentos_diarios.data_ref IS 'Data de referência do procedimento (data da venda)';
COMMENT ON COLUMN procedimentos_diarios.cod_estab IS 'Código do estabelecimento Belle';
COMMENT ON COLUMN procedimentos_diarios.nome_estab IS 'Nome do estabelecimento';
COMMENT ON COLUMN procedimentos_diarios.nome_proc IS 'Nome do procedimento/serviço';
