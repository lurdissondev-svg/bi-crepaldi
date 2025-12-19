-- ============================================================
-- BI CREPALDI - Phase 2: Bitrix24 Metrics Enhancement
-- Version: 2.0.0
-- Description: Stage history, conversion times, return customers
-- ============================================================

-- ============================================================
-- 1. DEAL STAGE HISTORY (Bitrix24)
-- ============================================================

-- Histórico de mudanças de estágio dos deals
CREATE TABLE IF NOT EXISTS deal_stage_history (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL,
    bitrix_deal_id INTEGER NOT NULL,
    from_stage_id VARCHAR(50),
    to_stage_id VARCHAR(50) NOT NULL,
    from_stage_name VARCHAR(100),
    to_stage_name VARCHAR(100),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_by_id INTEGER,
    days_in_previous_stage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_bitrix_deal_id ON deal_stage_history(bitrix_deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_at ON deal_stage_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_to_stage ON deal_stage_history(to_stage_id);

COMMENT ON TABLE deal_stage_history IS 'Histórico de transições de estágio dos deals do Bitrix24';

-- ============================================================
-- 2. LEAD STAGE HISTORY (Bitrix24)
-- ============================================================

-- Histórico de mudanças de status dos leads
CREATE TABLE IF NOT EXISTS lead_status_history (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    bitrix_lead_id INTEGER NOT NULL,
    from_status_id VARCHAR(50),
    to_status_id VARCHAR(50) NOT NULL,
    from_status_name VARCHAR(100),
    to_status_name VARCHAR(100),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_by_id INTEGER,
    days_in_previous_status INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_bitrix_lead_id ON lead_status_history(bitrix_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_to_status ON lead_status_history(to_status_id);

COMMENT ON TABLE lead_status_history IS 'Histórico de transições de status dos leads do Bitrix24';

-- ============================================================
-- 3. CUSTOMER ANALYTICS (Belle Software Integration)
-- ============================================================

-- Métricas de lifetime do cliente
CREATE TABLE IF NOT EXISTS customer_analytics (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER UNIQUE NOT NULL,
    cliente_nome VARCHAR(255),

    -- Métricas de compra
    primeira_compra_at TIMESTAMP WITH TIME ZONE,
    ultima_compra_at TIMESTAMP WITH TIME ZONE,
    total_compras INTEGER DEFAULT 0,
    total_gasto DECIMAL(15,2) DEFAULT 0,
    ticket_medio DECIMAL(15,2) DEFAULT 0,

    -- Métricas de recorrência
    is_returning_customer BOOLEAN DEFAULT false,
    dias_como_cliente INTEGER DEFAULT 0,
    frequencia_mensal DECIMAL(5,2) DEFAULT 0,

    -- Lifetime Value
    lifetime_value DECIMAL(15,2) DEFAULT 0,
    predicted_ltv DECIMAL(15,2) DEFAULT 0,

    -- Segmentação RFM
    rfm_recency_score INTEGER DEFAULT 0,
    rfm_frequency_score INTEGER DEFAULT 0,
    rfm_monetary_score INTEGER DEFAULT 0,
    rfm_segment VARCHAR(50),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_cliente_id ON customer_analytics(cliente_id);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_returning ON customer_analytics(is_returning_customer);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_rfm_segment ON customer_analytics(rfm_segment);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_ltv ON customer_analytics(lifetime_value DESC);

COMMENT ON TABLE customer_analytics IS 'Métricas de lifetime value e segmentação RFM dos clientes';

-- ============================================================
-- 4. CONVERSION METRICS VIEW
-- ============================================================

-- View para métricas de conversão
CREATE OR REPLACE VIEW vw_conversion_metrics AS
SELECT
    DATE_TRUNC('month', l.bitrix_created_at) AS mes,
    COUNT(*) AS total_leads,
    COUNT(CASE WHEN ls.semantica = 'S' THEN 1 END) AS leads_convertidos,
    COUNT(CASE WHEN ls.semantica = 'F' THEN 1 END) AS leads_desqualificados,
    COUNT(CASE WHEN ls.semantica = 'P' THEN 1 END) AS leads_em_progresso,
    ROUND(COUNT(CASE WHEN ls.semantica = 'S' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) AS taxa_conversao,
    ROUND(AVG(CASE WHEN ls.semantica = 'S' AND l.bitrix_closed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (l.bitrix_closed_at - l.bitrix_created_at)) / 86400
        END), 1) AS avg_dias_conversao,
    ROUND(AVG(CASE WHEN ls.semantica = 'P'
        THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - l.bitrix_created_at)) / 86400
        END), 1) AS avg_dias_em_atendimento
FROM leads l
LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
WHERE l.bitrix_created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', l.bitrix_created_at)
ORDER BY mes DESC;

COMMENT ON VIEW vw_conversion_metrics IS 'Métricas mensais de conversão de leads';

-- ============================================================
-- 5. RETURNING CUSTOMERS VIEW
-- ============================================================

-- View para análise de clientes recorrentes
CREATE OR REPLACE VIEW vw_returning_customers AS
SELECT
    c.cod_cliente,
    c.nome,
    COUNT(v.id) AS total_vendas,
    SUM(v.valor_liquido) AS total_gasto,
    MIN(v.data_venda) AS primeira_compra,
    MAX(v.data_venda) AS ultima_compra,
    EXTRACT(DAY FROM MAX(v.data_venda) - MIN(v.data_venda)) AS dias_como_cliente,
    CASE WHEN COUNT(v.id) > 1 THEN true ELSE false END AS is_returning,
    ROUND(SUM(v.valor_liquido) / NULLIF(COUNT(v.id), 0), 2) AS ticket_medio,
    ROUND(COUNT(v.id)::DECIMAL / NULLIF(EXTRACT(MONTH FROM AGE(MAX(v.data_venda), MIN(v.data_venda))) + 1, 0), 2) AS freq_mensal
FROM clientes c
LEFT JOIN vendas v ON c.cod_cliente = v.cod_cliente
GROUP BY c.cod_cliente, c.nome
HAVING COUNT(v.id) > 0;

COMMENT ON VIEW vw_returning_customers IS 'Análise de clientes recorrentes com métricas de frequência';

-- ============================================================
-- 6. LEAD TO CUSTOMER MAPPING
-- ============================================================

-- Mapeamento de leads para clientes (para tracking de recorrência)
CREATE TABLE IF NOT EXISTS lead_customer_mapping (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER,
    bitrix_lead_id INTEGER,
    cliente_id INTEGER,
    matched_by VARCHAR(30), -- 'phone', 'email', 'name'
    match_confidence DECIMAL(3,2) DEFAULT 1.0,
    is_returning_customer BOOLEAN DEFAULT false,
    previous_purchases INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_customer_mapping_lead ON lead_customer_mapping(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_customer_mapping_cliente ON lead_customer_mapping(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lead_customer_mapping_bitrix_lead ON lead_customer_mapping(bitrix_lead_id);

COMMENT ON TABLE lead_customer_mapping IS 'Mapeamento entre leads do Bitrix24 e clientes da Belle Software';

-- ============================================================
-- 7. ALTER EXISTING TABLES
-- ============================================================

-- Adicionar colunas em leads se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'is_returning_customer') THEN
        ALTER TABLE leads ADD COLUMN is_returning_customer BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'matched_cliente_id') THEN
        ALTER TABLE leads ADD COLUMN matched_cliente_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'conversion_days') THEN
        ALTER TABLE leads ADD COLUMN conversion_days INTEGER;
    END IF;
END $$;

-- Adicionar colunas em deals se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'first_stage_at') THEN
        ALTER TABLE deals ADD COLUMN first_stage_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'days_in_pipeline') THEN
        ALTER TABLE deals ADD COLUMN days_in_pipeline INTEGER;
    END IF;
END $$;

-- ============================================================
-- 8. FUNNEL STAGE ANALYTICS
-- ============================================================

-- Tabela para métricas agregadas do funil
CREATE TABLE IF NOT EXISTS funnel_stage_metrics (
    id SERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    stage_id VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100),
    stage_type VARCHAR(20), -- 'lead_status' ou 'deal_stage'

    -- Contagens
    entries_count INTEGER DEFAULT 0,
    exits_count INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,

    -- Tempos
    avg_days_in_stage DECIMAL(10,2) DEFAULT 0,
    median_days_in_stage DECIMAL(10,2) DEFAULT 0,
    min_days_in_stage INTEGER DEFAULT 0,
    max_days_in_stage INTEGER DEFAULT 0,

    -- Conversão
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    drop_off_rate DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_funnel_metrics_period ON funnel_stage_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_stage ON funnel_stage_metrics(stage_id);

COMMENT ON TABLE funnel_stage_metrics IS 'Métricas agregadas por estágio do funil para análise de performance';

-- ============================================================
-- 9. MARKETING SPEND TABLE (for Phase 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_spend (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'meta', 'google', 'other'
    campaign_id VARCHAR(100),
    campaign_name VARCHAR(255),
    adset_id VARCHAR(100),
    adset_name VARCHAR(255),

    -- Métricas de gasto
    spend DECIMAL(15,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    -- Métricas calculadas
    cpm DECIMAL(10,2) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(date, platform, campaign_id, adset_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_spend_date ON marketing_spend(date);
CREATE INDEX IF NOT EXISTS idx_marketing_spend_platform ON marketing_spend(platform);
CREATE INDEX IF NOT EXISTS idx_marketing_spend_campaign ON marketing_spend(campaign_id);

COMMENT ON TABLE marketing_spend IS 'Gastos de marketing por plataforma e campanha';

-- ============================================================
-- 10. ROI METRICS VIEW
-- ============================================================

-- View para cálculo de ROI por fonte
CREATE OR REPLACE VIEW vw_marketing_roi AS
SELECT
    COALESCE(l.utm_source, 'organic') AS source,
    COALESCE(l.utm_campaign, 'direct') AS campaign,
    DATE_TRUNC('month', l.bitrix_created_at) AS mes,
    COUNT(l.id) AS total_leads,
    COUNT(CASE WHEN ls.semantica = 'S' THEN 1 END) AS converted_leads,
    COALESCE(SUM(lsc.revenue), 0) AS total_revenue,
    COALESCE(ms.total_spend, 0) AS total_spend,
    CASE
        WHEN COALESCE(ms.total_spend, 0) > 0
        THEN ROUND(COALESCE(SUM(lsc.revenue), 0) / ms.total_spend, 2)
        ELSE 0
    END AS roas,
    CASE
        WHEN COUNT(l.id) > 0
        THEN ROUND(COALESCE(ms.total_spend, 0) / COUNT(l.id), 2)
        ELSE 0
    END AS cpl
FROM leads l
LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
LEFT JOIN lead_sale_correlations lsc ON l.id = lsc.lead_id
LEFT JOIN (
    SELECT
        DATE_TRUNC('month', date) AS mes,
        SUM(spend) AS total_spend
    FROM marketing_spend
    GROUP BY DATE_TRUNC('month', date)
) ms ON DATE_TRUNC('month', l.bitrix_created_at) = ms.mes
WHERE l.bitrix_created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY
    COALESCE(l.utm_source, 'organic'),
    COALESCE(l.utm_campaign, 'direct'),
    DATE_TRUNC('month', l.bitrix_created_at),
    ms.total_spend
ORDER BY mes DESC, total_leads DESC;

COMMENT ON VIEW vw_marketing_roi IS 'ROI de marketing por fonte e campanha';
