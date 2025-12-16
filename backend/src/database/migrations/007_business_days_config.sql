-- Migration: Business Days Configuration
-- Allows manual override of business days per month

-- Table to store business days configuration per month
CREATE TABLE IF NOT EXISTS business_days_config (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    business_days INTEGER NOT NULL CHECK (business_days >= 0 AND business_days <= 31),
    calculated_days INTEGER, -- Store the auto-calculated value for reference
    notes TEXT, -- Optional notes about why this was overridden
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_days_year_month ON business_days_config(year, month);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_business_days_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_business_days_config_updated_at ON business_days_config;
CREATE TRIGGER trigger_business_days_config_updated_at
    BEFORE UPDATE ON business_days_config
    FOR EACH ROW
    EXECUTE FUNCTION update_business_days_config_updated_at();

-- Pre-populate with 2025 months (can be adjusted later)
-- These are approximate values, users can edit them
INSERT INTO business_days_config (year, month, business_days, calculated_days, notes) VALUES
    (2025, 1, 21, 21, 'Janeiro - 1 feriado (Ano Novo)'),
    (2025, 2, 18, 18, 'Fevereiro - 3 dias de Carnaval'),
    (2025, 3, 21, 21, 'Marco - Sem feriados'),
    (2025, 4, 20, 20, 'Abril - Tiradentes + Sexta Santa + Aniversario Cuiaba'),
    (2025, 5, 21, 21, 'Maio - Dia do Trabalho'),
    (2025, 6, 19, 19, 'Junho - Corpus Christi'),
    (2025, 7, 23, 23, 'Julho - Sem feriados'),
    (2025, 8, 21, 21, 'Agosto - Sem feriados'),
    (2025, 9, 21, 21, 'Setembro - Independencia'),
    (2025, 10, 22, 22, 'Outubro - Nossa Senhora Aparecida'),
    (2025, 11, 18, 18, 'Novembro - Finados + Proclamacao + Consciencia Negra'),
    (2025, 12, 21, 21, 'Dezembro - Natal')
ON CONFLICT (year, month) DO NOTHING;

-- Pre-populate 2026 as well
INSERT INTO business_days_config (year, month, business_days, calculated_days, notes) VALUES
    (2026, 1, 21, 21, 'Janeiro'),
    (2026, 2, 18, 18, 'Fevereiro'),
    (2026, 3, 22, 22, 'Marco'),
    (2026, 4, 20, 20, 'Abril'),
    (2026, 5, 20, 20, 'Maio'),
    (2026, 6, 21, 21, 'Junho'),
    (2026, 7, 23, 23, 'Julho'),
    (2026, 8, 21, 21, 'Agosto'),
    (2026, 9, 21, 21, 'Setembro'),
    (2026, 10, 22, 22, 'Outubro'),
    (2026, 11, 19, 19, 'Novembro'),
    (2026, 12, 21, 21, 'Dezembro')
ON CONFLICT (year, month) DO NOTHING;
