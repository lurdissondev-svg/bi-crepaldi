-- ============================================================
-- Customer Enrichment - Migration 012
-- Adiciona estrutura para enriquecimento automático de dados
-- de contato de clientes
-- ============================================================

-- Campos novos na tabela clientes para tracking de enriquecimento
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS enrichment_source VARCHAR(50);

COMMENT ON COLUMN clientes.enriched_at IS 'Timestamp do último enriquecimento de dados';
COMMENT ON COLUMN clientes.enrichment_source IS 'Fonte do último enriquecimento (bitrix_lead, raw_data, cross_estab)';

-- Tabela de log para auditoria de enriquecimentos
CREATE TABLE IF NOT EXISTS customer_enrichment_log (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    cod_cliente INTEGER NOT NULL,
    cod_estab INTEGER NOT NULL,
    field_name VARCHAR(20) NOT NULL, -- 'telefone', 'celular', 'email'
    old_value TEXT,
    new_value TEXT,
    source VARCHAR(50) NOT NULL, -- 'bitrix_lead', 'raw_data', 'cross_estab'
    source_id TEXT, -- ID do registro fonte (lead_id, conta_id, etc)
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_enrichment_cliente FOREIGN KEY (cliente_id)
        REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_enrichment_log_cliente ON customer_enrichment_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_cod_cliente ON customer_enrichment_log(cod_cliente, cod_estab);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_date ON customer_enrichment_log(enriched_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_source ON customer_enrichment_log(source);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_field ON customer_enrichment_log(field_name);

COMMENT ON TABLE customer_enrichment_log IS 'Log de enriquecimento de dados de contato de clientes';

-- Adicionar entrada na tabela sync_status para o job de enriquecimento
INSERT INTO sync_status (entity_type, sync_interval_minutes, is_enabled) VALUES
    ('customer_enrichment', 30, true)
ON CONFLICT (entity_type) DO NOTHING;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
