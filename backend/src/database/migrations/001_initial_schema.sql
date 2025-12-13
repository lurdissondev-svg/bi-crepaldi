-- ============================================================
-- BI CREPALDI - Database Schema
-- Version: 1.0.0
-- Created by: Senior Data Analyst Architecture
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para buscas fuzzy

-- ============================================================
-- TABELAS DE DOMÍNIO (Dimensões)
-- ============================================================

-- Estabelecimentos/Centros de Custo (Belle Software)
CREATE TABLE IF NOT EXISTS estabelecimentos (
    id SERIAL PRIMARY KEY,
    cod_estab INTEGER UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE estabelecimentos IS 'Centros de custo da Belle Software (Dermato, SPA, Convênio, etc.)';

-- Formas de Pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
    id SERIAL PRIMARY KEY,
    cod_forma INTEGER UNIQUE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50), -- Cartão, Dinheiro, PIX, etc.
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE formas_pagamento IS 'Formas de pagamento disponíveis no sistema Belle';

-- ============================================================
-- TABELAS BITRIX24 (CRM)
-- ============================================================

-- Status de Lead (Bitrix24)
CREATE TABLE IF NOT EXISTS lead_statuses (
    id SERIAL PRIMARY KEY,
    bitrix_status_id VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    semantica VARCHAR(10), -- P (processo), S (sucesso), F (falha)
    cor VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE lead_statuses IS 'Status de leads do Bitrix24 com semântica de processo';

-- Fontes de Lead (Bitrix24)
CREATE TABLE IF NOT EXISTS lead_sources (
    id SERIAL PRIMARY KEY,
    bitrix_source_id VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE lead_sources IS 'Origens/fontes de leads do Bitrix24';

-- Leads (Bitrix24)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    bitrix_id INTEGER UNIQUE NOT NULL,
    titulo VARCHAR(255),
    nome VARCHAR(100),
    sobrenome VARCHAR(100),

    -- Status e Fonte
    status_id VARCHAR(50),
    source_id VARCHAR(50),
    source_description TEXT,

    -- Contato
    telefones JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    empresa VARCHAR(255),

    -- UTM Tracking
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),

    -- Valores
    opportunity DECIMAL(15,2) DEFAULT 0,
    currency_id VARCHAR(10) DEFAULT 'BRL',

    -- Responsável
    assigned_by_id INTEGER,

    -- Datas Bitrix
    bitrix_created_at TIMESTAMP WITH TIME ZONE,
    bitrix_modified_at TIMESTAMP WITH TIME ZONE,
    bitrix_closed_at TIMESTAMP WITH TIME ZONE,

    -- Campos customizados (armazenados como JSONB)
    custom_fields JSONB DEFAULT '{}',

    -- Metadados de sync
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_lead_status FOREIGN KEY (status_id)
        REFERENCES lead_statuses(bitrix_status_id) ON UPDATE CASCADE,
    CONSTRAINT fk_lead_source FOREIGN KEY (source_id)
        REFERENCES lead_sources(bitrix_source_id) ON UPDATE CASCADE
);

-- Índices para Leads
CREATE INDEX IF NOT EXISTS idx_leads_bitrix_id ON leads(bitrix_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(bitrix_created_at);
CREATE INDEX IF NOT EXISTS idx_leads_telefones ON leads USING GIN(telefones);
CREATE INDEX IF NOT EXISTS idx_leads_emails ON leads USING GIN(emails);

COMMENT ON TABLE leads IS 'Leads do Bitrix24 CRM com tracking UTM completo';

-- Estágios de Deal (Bitrix24)
CREATE TABLE IF NOT EXISTS deal_stages (
    id SERIAL PRIMARY KEY,
    bitrix_stage_id VARCHAR(50) UNIQUE NOT NULL,
    category_id INTEGER DEFAULT 0,
    nome VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    semantica VARCHAR(10), -- P (processo), S (sucesso), F (falha)
    cor VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE deal_stages IS 'Estágios do funil de vendas do Bitrix24';

-- Deals/Negócios (Bitrix24)
CREATE TABLE IF NOT EXISTS deals (
    id SERIAL PRIMARY KEY,
    bitrix_id INTEGER UNIQUE NOT NULL,
    titulo VARCHAR(255),

    -- Pipeline
    stage_id VARCHAR(50),
    category_id INTEGER DEFAULT 0,

    -- Valores
    opportunity DECIMAL(15,2) DEFAULT 0,
    currency_id VARCHAR(10) DEFAULT 'BRL',

    -- Relacionamentos
    contact_id INTEGER,
    company_id INTEGER,
    source_id VARCHAR(50),
    assigned_by_id INTEGER,

    -- UTM Tracking
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),

    -- Datas Bitrix
    bitrix_created_at TIMESTAMP WITH TIME ZONE,
    bitrix_modified_at TIMESTAMP WITH TIME ZONE,
    close_date DATE,

    -- Campos customizados
    custom_fields JSONB DEFAULT '{}',

    -- Metadados de sync
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_deal_stage FOREIGN KEY (stage_id)
        REFERENCES deal_stages(bitrix_stage_id) ON UPDATE CASCADE
);

-- Índices para Deals
CREATE INDEX IF NOT EXISTS idx_deals_bitrix_id ON deals(bitrix_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(bitrix_created_at);

COMMENT ON TABLE deals IS 'Negócios/Oportunidades do Bitrix24';

-- ============================================================
-- TABELAS BELLE SOFTWARE (Financeiro)
-- ============================================================

-- Clientes (Belle Software)
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    cod_cliente INTEGER NOT NULL,
    cod_estab INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    celular VARCHAR(50),
    email VARCHAR(255),
    cpf VARCHAR(20),
    data_nascimento DATE,
    sexo CHAR(1),

    -- Endereço
    endereco TEXT,
    cidade VARCHAR(100),
    uf CHAR(2),
    cep VARCHAR(15),

    -- Datas
    data_cadastro DATE,
    ultima_visita DATE,

    -- Metadados
    ativo BOOLEAN DEFAULT true,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique por estabelecimento
    CONSTRAINT uq_cliente_estab UNIQUE (cod_cliente, cod_estab),
    CONSTRAINT fk_cliente_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

-- Índices para Clientes
CREATE INDEX IF NOT EXISTS idx_clientes_cod ON clientes(cod_cliente, cod_estab);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_celular ON clientes(celular);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes USING GIN(nome gin_trgm_ops);

COMMENT ON TABLE clientes IS 'Clientes/Pacientes da Belle Software';

-- Profissionais (Belle Software)
CREATE TABLE IF NOT EXISTS profissionais (
    id SERIAL PRIMARY KEY,
    cod_profissional INTEGER NOT NULL,
    cod_estab INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    especialidade VARCHAR(100),
    ativo BOOLEAN DEFAULT true,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_profissional_estab UNIQUE (cod_profissional, cod_estab),
    CONSTRAINT fk_profissional_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

COMMENT ON TABLE profissionais IS 'Profissionais/Médicos da Belle Software';

-- Vendas (Belle Software)
CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    cod_venda INTEGER NOT NULL,
    cod_estab INTEGER NOT NULL,
    cod_cliente INTEGER,

    -- Valores
    valor_venda DECIMAL(15,2) DEFAULT 0,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2) DEFAULT 0,

    -- Data
    data_venda TIMESTAMP WITH TIME ZONE,

    -- Profissional
    cod_profissional INTEGER,
    nome_profissional VARCHAR(255),

    -- Status
    status VARCHAR(50),
    confirmado CHAR(1) DEFAULT 'N',

    -- Dados originais
    raw_data JSONB DEFAULT '{}',

    -- Metadados
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_venda_estab UNIQUE (cod_venda, cod_estab),
    CONSTRAINT fk_venda_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

-- Índices para Vendas
CREATE INDEX IF NOT EXISTS idx_vendas_cod ON vendas(cod_venda, cod_estab);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(cod_cliente, cod_estab);
CREATE INDEX IF NOT EXISTS idx_vendas_profissional ON vendas(cod_profissional);
CREATE INDEX IF NOT EXISTS idx_vendas_confirmado ON vendas(confirmado);

COMMENT ON TABLE vendas IS 'Vendas realizadas na Belle Software';

-- Itens de Venda (Belle Software)
CREATE TABLE IF NOT EXISTS vendas_itens (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER NOT NULL,
    cod_item INTEGER,
    desc_item VARCHAR(255),
    quantidade INTEGER DEFAULT 1,
    valor_unitario DECIMAL(15,2) DEFAULT 0,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2) DEFAULT 0,

    -- Tipo (procedimento, produto, etc.)
    tipo VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_item_venda FOREIGN KEY (venda_id)
        REFERENCES vendas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda ON vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_desc ON vendas_itens USING GIN(desc_item gin_trgm_ops);

COMMENT ON TABLE vendas_itens IS 'Itens/Procedimentos das vendas';

-- Contas a Receber (Belle Software)
CREATE TABLE IF NOT EXISTS contas_receber (
    id SERIAL PRIMARY KEY,
    cod_conta INTEGER NOT NULL,
    cod_estab INTEGER NOT NULL,
    cod_cliente INTEGER,
    cod_venda INTEGER,

    -- Valores
    valor_bruto DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2) DEFAULT 0,
    valor_pago DECIMAL(15,2) DEFAULT 0,

    -- Forma de pagamento
    cod_forma_pagamento INTEGER,
    nome_forma_pagamento VARCHAR(100),

    -- Datas
    dt_lancamento DATE,
    dt_vencimento DATE,
    dt_pagamento DATE,

    -- Status
    confirmado CHAR(1) DEFAULT 'N',
    status VARCHAR(50),

    -- Dados originais
    raw_data JSONB DEFAULT '{}',

    -- Metadados
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_conta_estab UNIQUE (cod_conta, cod_estab),
    CONSTRAINT fk_conta_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

-- Índices para Contas a Receber
CREATE INDEX IF NOT EXISTS idx_contas_receber_dt_lancamento ON contas_receber(dt_lancamento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_dt_vencimento ON contas_receber(dt_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_confirmado ON contas_receber(confirmado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente ON contas_receber(cod_cliente);
CREATE INDEX IF NOT EXISTS idx_contas_receber_estab ON contas_receber(cod_estab);

COMMENT ON TABLE contas_receber IS 'Contas a receber/Faturamento da Belle Software';

-- ============================================================
-- TABELA DE CORRELAÇÃO LEAD -> VENDA
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_sale_correlations (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    venda_id INTEGER NOT NULL,

    -- Matching info
    matched_by VARCHAR(20) NOT NULL, -- 'phone', 'phone_partial', 'email'
    match_confidence DECIMAL(3,2) DEFAULT 0, -- 0.00 a 1.00

    -- Valor da conversão
    revenue DECIMAL(15,2) DEFAULT 0,

    -- Datas
    lead_date TIMESTAMP WITH TIME ZONE,
    sale_date TIMESTAMP WITH TIME ZONE,
    days_to_convert INTEGER,

    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_lead_sale UNIQUE (lead_id, venda_id),
    CONSTRAINT fk_correlation_lead FOREIGN KEY (lead_id)
        REFERENCES leads(id) ON DELETE CASCADE,
    CONSTRAINT fk_correlation_venda FOREIGN KEY (venda_id)
        REFERENCES vendas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_correlations_lead ON lead_sale_correlations(lead_id);
CREATE INDEX IF NOT EXISTS idx_correlations_venda ON lead_sale_correlations(venda_id);
CREATE INDEX IF NOT EXISTS idx_correlations_matched_by ON lead_sale_correlations(matched_by);

COMMENT ON TABLE lead_sale_correlations IS 'Correlações entre leads do Bitrix e vendas da Belle';

-- ============================================================
-- TABELAS META ADS
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_ads_config (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(100),
    app_secret_encrypted TEXT,
    access_token_encrypted TEXT,
    ad_account_id VARCHAR(100),
    pixel_id VARCHAR(100),
    is_configured BOOLEAN DEFAULT false,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE meta_ads_config IS 'Configurações de integração Meta Ads';

CREATE TABLE IF NOT EXISTS meta_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) UNIQUE NOT NULL,
    nome VARCHAR(255),
    status VARCHAR(50),
    objective VARCHAR(100),
    daily_budget DECIMAL(15,2),
    lifetime_budget DECIMAL(15,2),
    start_time TIMESTAMP WITH TIME ZONE,
    stop_time TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE meta_campaigns IS 'Campanhas do Meta Ads';

CREATE TABLE IF NOT EXISTS meta_insights (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100),
    data_referencia DATE NOT NULL,

    -- Métricas
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend DECIMAL(15,2) DEFAULT 0,
    cpc DECIMAL(10,4) DEFAULT 0,
    cpm DECIMAL(10,4) DEFAULT 0,
    ctr DECIMAL(10,4) DEFAULT 0,

    -- Conversões
    conversions INTEGER DEFAULT 0,
    conversion_value DECIMAL(15,2) DEFAULT 0,
    cost_per_conversion DECIMAL(15,2) DEFAULT 0,

    -- Dados completos
    raw_data JSONB DEFAULT '{}',

    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_insight_campaign_date UNIQUE (campaign_id, data_referencia),
    CONSTRAINT fk_insight_campaign FOREIGN KEY (campaign_id)
        REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_insights(data_referencia);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign ON meta_insights(campaign_id);

COMMENT ON TABLE meta_insights IS 'Métricas diárias das campanhas Meta Ads';

-- ============================================================
-- TABELAS DE CONTROLE DE SINCRONIZAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'leads', 'deals', 'vendas', 'contas_receber', etc.
    operation VARCHAR(20) NOT NULL, -- 'full_sync', 'incremental', 'correlation'
    status VARCHAR(20) NOT NULL, -- 'running', 'success', 'error', 'partial'

    -- Métricas
    records_fetched INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    records_error INTEGER DEFAULT 0,

    -- Período sincronizado
    date_from DATE,
    date_to DATE,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- Erros
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_entity ON sync_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);

COMMENT ON TABLE sync_logs IS 'Log de operações de sincronização';

CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) UNIQUE NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_log_id INTEGER,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    sync_interval_minutes INTEGER DEFAULT 5,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sync_status_log FOREIGN KEY (last_sync_log_id)
        REFERENCES sync_logs(id) ON DELETE SET NULL
);

COMMENT ON TABLE sync_status IS 'Status atual de sincronização por entidade';

-- ============================================================
-- TABELAS AGREGADAS (Para Performance)
-- ============================================================

-- Faturamento Diário Agregado
CREATE TABLE IF NOT EXISTS faturamento_diario (
    id SERIAL PRIMARY KEY,
    data_referencia DATE NOT NULL,
    cod_estab INTEGER NOT NULL,

    -- Métricas
    valor_total DECIMAL(15,2) DEFAULT 0,
    quantidade_movimentos INTEGER DEFAULT 0,
    ticket_medio DECIMAL(15,2) DEFAULT 0,

    -- Por forma de pagamento (JSONB para flexibilidade)
    por_forma_pagamento JSONB DEFAULT '{}',

    -- Metadados
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_faturamento_dia_estab UNIQUE (data_referencia, cod_estab),
    CONSTRAINT fk_faturamento_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faturamento_diario_data ON faturamento_diario(data_referencia);
CREATE INDEX IF NOT EXISTS idx_faturamento_diario_estab ON faturamento_diario(cod_estab);

COMMENT ON TABLE faturamento_diario IS 'Faturamento agregado por dia e estabelecimento';

-- Leads Diário Agregado
CREATE TABLE IF NOT EXISTS leads_diario (
    id SERIAL PRIMARY KEY,
    data_referencia DATE NOT NULL,

    -- Contagens
    total_leads INTEGER DEFAULT 0,
    leads_novos INTEGER DEFAULT 0,
    leads_em_andamento INTEGER DEFAULT 0,
    leads_convertidos INTEGER DEFAULT 0,
    leads_perdidos INTEGER DEFAULT 0,

    -- Por fonte (JSONB)
    por_fonte JSONB DEFAULT '{}',

    -- Por UTM Source (JSONB)
    por_utm_source JSONB DEFAULT '{}',

    -- Por hora (JSONB)
    por_hora JSONB DEFAULT '{}',

    -- Metadados
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_leads_dia UNIQUE (data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_leads_diario_data ON leads_diario(data_referencia);

COMMENT ON TABLE leads_diario IS 'Leads agregados por dia com breakdown por fonte';

-- Metas
CREATE TABLE IF NOT EXISTS metas (
    id SERIAL PRIMARY KEY,
    cod_estab INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,

    -- Valores
    meta_faturamento DECIMAL(15,2) DEFAULT 0,
    meta_vendas INTEGER DEFAULT 0,
    meta_ticket_medio DECIMAL(15,2) DEFAULT 0,
    meta_leads INTEGER DEFAULT 0,
    meta_conversao DECIMAL(5,2) DEFAULT 0,

    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_meta_estab_periodo UNIQUE (cod_estab, ano, mes),
    CONSTRAINT fk_meta_estab FOREIGN KEY (cod_estab)
        REFERENCES estabelecimentos(cod_estab) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metas_periodo ON metas(ano, mes);

COMMENT ON TABLE metas IS 'Metas mensais por estabelecimento';

-- ============================================================
-- VIEWS PARA ANÁLISES
-- ============================================================

-- View: Funil de Conversão
CREATE OR REPLACE VIEW vw_funil_conversao AS
SELECT
    date_trunc('day', l.bitrix_created_at) as data,
    ls.nome as status,
    ls.semantica,
    COUNT(*) as quantidade,
    ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY date_trunc('day', l.bitrix_created_at)), 0), 2) as percentual
FROM leads l
LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
WHERE l.bitrix_created_at IS NOT NULL
GROUP BY date_trunc('day', l.bitrix_created_at), ls.nome, ls.semantica
ORDER BY data DESC, quantidade DESC;

-- View: ROI por Fonte
CREATE OR REPLACE VIEW vw_roi_por_fonte AS
SELECT
    COALESCE(l.utm_source, 'Desconhecido') as fonte,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT lsc.id) as leads_convertidos,
    ROUND(COUNT(DISTINCT lsc.id) * 100.0 / NULLIF(COUNT(DISTINCT l.id), 0), 2) as taxa_conversao,
    COALESCE(SUM(lsc.revenue), 0) as receita_total,
    ROUND(COALESCE(SUM(lsc.revenue), 0) / NULLIF(COUNT(DISTINCT l.id), 0), 2) as receita_por_lead,
    ROUND(COALESCE(SUM(lsc.revenue), 0) / NULLIF(COUNT(DISTINCT lsc.id), 0), 2) as ticket_medio
FROM leads l
LEFT JOIN lead_sale_correlations lsc ON l.id = lsc.lead_id
GROUP BY l.utm_source
ORDER BY receita_total DESC;

-- View: Faturamento por Estabelecimento
CREATE OR REPLACE VIEW vw_faturamento_estabelecimento AS
SELECT
    e.cod_estab,
    e.nome as estabelecimento,
    date_trunc('month', cr.dt_lancamento) as mes,
    SUM(CASE WHEN cr.confirmado = 'S' THEN cr.valor_bruto ELSE 0 END) as faturamento,
    COUNT(CASE WHEN cr.confirmado = 'S' THEN 1 END) as quantidade,
    ROUND(AVG(CASE WHEN cr.confirmado = 'S' THEN cr.valor_bruto END), 2) as ticket_medio
FROM estabelecimentos e
LEFT JOIN contas_receber cr ON e.cod_estab = cr.cod_estab
GROUP BY e.cod_estab, e.nome, date_trunc('month', cr.dt_lancamento)
ORDER BY mes DESC, faturamento DESC;

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Função: Normalizar telefone
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 11);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função: Atualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_estabelecimentos_updated_at BEFORE UPDATE ON estabelecimentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contas_receber_updated_at BEFORE UPDATE ON contas_receber
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metas_updated_at BEFORE UPDATE ON metas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED INICIAL - Estabelecimentos
-- ============================================================

INSERT INTO estabelecimentos (cod_estab, nome) VALUES
    (1, 'Dermato'),
    (2, 'SPA'),
    (5, 'Convênio'),
    (10, 'Drips'),
    (11, 'Estética'),
    (12, 'Bela Laser'),
    (14, 'Nutrologia')
ON CONFLICT (cod_estab) DO UPDATE SET
    nome = EXCLUDED.nome,
    updated_at = CURRENT_TIMESTAMP;

-- Seed inicial - Sync Status
INSERT INTO sync_status (entity_type, sync_interval_minutes, is_enabled) VALUES
    ('leads', 5, true),
    ('deals', 5, true),
    ('lead_statuses', 60, true),
    ('lead_sources', 60, true),
    ('deal_stages', 60, true),
    ('vendas', 5, true),
    ('contas_receber', 5, true),
    ('clientes', 30, true),
    ('correlations', 5, true),
    ('meta_campaigns', 15, true),
    ('meta_insights', 15, true)
ON CONFLICT (entity_type) DO NOTHING;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
