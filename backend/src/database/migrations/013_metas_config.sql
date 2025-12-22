-- Migration: Metas Configuration per Establishment
-- Allows manual configuration of goals per establishment/month

-- Table to store goals configuration
CREATE TABLE IF NOT EXISTS metas_config (
    id SERIAL PRIMARY KEY,
    cod_estab INTEGER NOT NULL,
    estabelecimento_nome VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    meta1 DECIMAL(15,2) NOT NULL DEFAULT 0,
    meta2 DECIMAL(15,2) NOT NULL DEFAULT 0,
    meta3 DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cod_estab, year, month)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_metas_config_estab_year_month ON metas_config(cod_estab, year, month);
CREATE INDEX IF NOT EXISTS idx_metas_config_year_month ON metas_config(year, month);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_metas_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_metas_config_updated_at ON metas_config;
CREATE TRIGGER trigger_metas_config_updated_at
    BEFORE UPDATE ON metas_config
    FOR EACH ROW
    EXECUTE FUNCTION update_metas_config_updated_at();

-- Pre-populate with default values for 2025 based on config
-- SPA (codestabs: 2, 11)
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT
    estab.cod_estab,
    'SPA',
    2025,
    m.month,
    700000,
    780000,
    850000,
    'Valores padrao SPA'
FROM (VALUES (2), (11)) AS estab(cod_estab)
CROSS JOIN generate_series(1, 12) AS m(month)
ON CONFLICT (cod_estab, year, month) DO NOTHING;

-- Convenios (codestab: 5)
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT
    5,
    'Convenios',
    2025,
    m.month,
    121000,
    136000,
    151000,
    'Valores padrao Convenios'
FROM generate_series(1, 12) AS m(month)
ON CONFLICT (cod_estab, year, month) DO NOTHING;

-- Bela Laser (codestab: 12)
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT
    12,
    'Bela Laser',
    2025,
    m.month,
    100000,
    124000,
    150000,
    'Valores padrao Bela Laser'
FROM generate_series(1, 12) AS m(month)
ON CONFLICT (cod_estab, year, month) DO NOTHING;

-- Nutrologia (codestab: 14)
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT
    14,
    'Nutrologia',
    2025,
    m.month,
    257000,
    294000,
    331000,
    'Valores padrao Nutrologia'
FROM generate_series(1, 12) AS m(month)
ON CONFLICT (cod_estab, year, month) DO NOTHING;

-- Dermato (codestab: 1)
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT
    1,
    'Dermato',
    2025,
    m.month,
    200000,
    250000,
    300000,
    'Valores padrao Dermato'
FROM generate_series(1, 12) AS m(month)
ON CONFLICT (cod_estab, year, month) DO NOTHING;

-- Pre-populate 2026
INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
SELECT cod_estab, estabelecimento_nome, 2026, month, meta1, meta2, meta3, notes
FROM metas_config WHERE year = 2025
ON CONFLICT (cod_estab, year, month) DO NOTHING;

COMMENT ON TABLE metas_config IS 'Configuracao de metas de faturamento por estabelecimento e mes';
