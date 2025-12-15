-- Migration: Tintim Integration
-- Tabelas para integração com Tintim (https://tintim.app)
-- Rastreamento de conversões WhatsApp com atribuição de campanhas

-- Tabela principal de conversas rastreadas pelo Tintim
CREATE TABLE IF NOT EXISTS tintim_conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    name VARCHAR(255),

    -- Dados UTM (atribuição de marketing)
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),

    -- Dados Meta Ads
    meta_campaign_id VARCHAR(100),
    meta_adset_id VARCHAR(100),
    meta_ad_id VARCHAR(100),

    -- Status e qualificação
    status VARCHAR(50) DEFAULT 'new',
    qualification VARCHAR(100),
    qualification_score INTEGER,

    -- Dados de venda
    sale_value DECIMAL(12, 2),
    sale_products JSONB,

    -- Timestamps
    started_at TIMESTAMP,
    qualified_at TIMESTAMP,
    sold_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Histórico de mudanças de status
CREATE TABLE IF NOT EXISTS tintim_status_history (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(100) REFERENCES tintim_conversations(conversation_id),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Eventos de webhook recebidos (auditoria)
CREATE TABLE IF NOT EXISTS tintim_webhook_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    event_timestamp TIMESTAMP,
    received_at TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT TRUE
);

-- Métricas de ROI por campanha (agregado)
CREATE TABLE IF NOT EXISTS marketing_roi_by_campaign (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) UNIQUE,
    campaign_name VARCHAR(255),
    total_leads INTEGER DEFAULT 0,
    converted_leads INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    total_spend DECIMAL(12, 2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tintim_conv_phone ON tintim_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_tintim_conv_status ON tintim_conversations(status);
CREATE INDEX IF NOT EXISTS idx_tintim_conv_started ON tintim_conversations(started_at);
CREATE INDEX IF NOT EXISTS idx_tintim_conv_utm_source ON tintim_conversations(utm_source);
CREATE INDEX IF NOT EXISTS idx_tintim_conv_utm_campaign ON tintim_conversations(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_tintim_conv_meta_campaign ON tintim_conversations(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_tintim_events_type ON tintim_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tintim_events_timestamp ON tintim_webhook_events(received_at);

-- Configuração da integração Tintim
CREATE TABLE IF NOT EXISTS tintim_config (
    id SERIAL PRIMARY KEY,
    webhook_secret VARCHAR(255),
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO tintim_config (enabled) VALUES (FALSE)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE tintim_conversations IS 'Conversas rastreadas pelo Tintim com dados de atribuição';
COMMENT ON TABLE tintim_status_history IS 'Histórico de mudanças de status das conversas';
COMMENT ON TABLE tintim_webhook_events IS 'Log de eventos webhook recebidos do Tintim';
COMMENT ON TABLE marketing_roi_by_campaign IS 'Métricas agregadas de ROI por campanha';
COMMENT ON TABLE tintim_config IS 'Configuração da integração com Tintim';
