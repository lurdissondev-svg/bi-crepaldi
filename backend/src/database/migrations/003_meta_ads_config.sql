-- ============================================================
-- BI CREPALDI - Phase 4: Meta Ads Configuration
-- Version: 3.0.0
-- Description: Persist Meta Ads configuration in database
-- ============================================================

-- ============================================================
-- 1. META ADS CONFIGURATION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_ads_config (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    app_secret_encrypted TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    ad_account_id VARCHAR(50) NOT NULL,
    pixel_id VARCHAR(50),
    account_name VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'BRL',
    status VARCHAR(20) DEFAULT 'pending', -- pending, configured, error
    error_message TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20), -- success, partial, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE meta_ads_config IS 'Configuração de integração com Meta Ads';

-- ============================================================
-- 2. ADD UTM TO LEADS TABLE IF NOT EXISTS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_content') THEN
        ALTER TABLE leads ADD COLUMN utm_content VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'utm_term') THEN
        ALTER TABLE leads ADD COLUMN utm_term VARCHAR(255);
    END IF;
END $$;

-- ============================================================
-- 3. MARKETING ROI VIEW
-- ============================================================

-- Drop and recreate the view to ensure it uses the correct structure
DROP VIEW IF EXISTS vw_marketing_roi_detailed;

CREATE OR REPLACE VIEW vw_marketing_roi_detailed AS
WITH lead_revenue AS (
    SELECT
        COALESCE(l.utm_source, 'organic') AS source,
        COALESCE(l.utm_campaign, 'direct') AS campaign,
        DATE_TRUNC('day', l.bitrix_created_at)::date AS lead_date,
        COUNT(DISTINCT l.id) AS total_leads,
        COUNT(DISTINCT CASE WHEN ls.semantica = 'S' THEN l.id END) AS converted_leads,
        COALESCE(SUM(CASE WHEN ls.semantica = 'S' THEN lsc.revenue ELSE 0 END), 0) AS total_revenue
    FROM leads l
    LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
    LEFT JOIN lead_sale_correlations lsc ON l.id = lsc.lead_id
    WHERE l.bitrix_created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY COALESCE(l.utm_source, 'organic'), COALESCE(l.utm_campaign, 'direct'), DATE_TRUNC('day', l.bitrix_created_at)::date
),
spend_data AS (
    SELECT
        date,
        platform,
        campaign_name,
        SUM(spend) AS total_spend,
        SUM(impressions) AS total_impressions,
        SUM(clicks) AS total_clicks
    FROM marketing_spend
    WHERE date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY date, platform, campaign_name
)
SELECT
    lr.source,
    lr.campaign,
    lr.lead_date,
    lr.total_leads,
    lr.converted_leads,
    lr.total_revenue,
    COALESCE(sd.total_spend, 0) AS total_spend,
    COALESCE(sd.total_impressions, 0) AS total_impressions,
    COALESCE(sd.total_clicks, 0) AS total_clicks,
    -- ROI Metrics
    CASE
        WHEN COALESCE(sd.total_spend, 0) > 0
        THEN ROUND((lr.total_revenue / sd.total_spend)::numeric, 2)
        ELSE NULL
    END AS roas,
    CASE
        WHEN lr.total_leads > 0
        THEN ROUND((COALESCE(sd.total_spend, 0) / lr.total_leads)::numeric, 2)
        ELSE NULL
    END AS cpl,
    CASE
        WHEN lr.converted_leads > 0
        THEN ROUND((COALESCE(sd.total_spend, 0) / lr.converted_leads)::numeric, 2)
        ELSE NULL
    END AS cpa,
    CASE
        WHEN lr.total_leads > 0
        THEN ROUND((lr.converted_leads::decimal / lr.total_leads * 100)::numeric, 2)
        ELSE 0
    END AS conversion_rate
FROM lead_revenue lr
LEFT JOIN spend_data sd ON lr.lead_date = sd.date
    AND (
        lr.source ILIKE '%' || sd.platform || '%'
        OR (lr.source = 'facebook' AND sd.platform = 'meta')
        OR (lr.source = 'instagram' AND sd.platform = 'meta')
        OR lr.campaign ILIKE '%' || sd.campaign_name || '%'
    )
ORDER BY lr.lead_date DESC;

COMMENT ON VIEW vw_marketing_roi_detailed IS 'ROI detalhado de marketing por dia, fonte e campanha';

-- ============================================================
-- 4. MARKETING SUMMARY VIEW
-- ============================================================

CREATE OR REPLACE VIEW vw_marketing_summary AS
SELECT
    DATE_TRUNC('month', lead_date)::date AS month,
    source,
    SUM(total_leads) AS total_leads,
    SUM(converted_leads) AS converted_leads,
    SUM(total_revenue) AS total_revenue,
    SUM(total_spend) AS total_spend,
    CASE
        WHEN SUM(total_spend) > 0
        THEN ROUND((SUM(total_revenue) / SUM(total_spend))::numeric, 2)
        ELSE NULL
    END AS roas,
    CASE
        WHEN SUM(total_leads) > 0
        THEN ROUND((SUM(total_spend) / SUM(total_leads))::numeric, 2)
        ELSE NULL
    END AS avg_cpl,
    CASE
        WHEN SUM(total_leads) > 0
        THEN ROUND((SUM(converted_leads)::decimal / SUM(total_leads) * 100)::numeric, 2)
        ELSE 0
    END AS conversion_rate
FROM vw_marketing_roi_detailed
GROUP BY DATE_TRUNC('month', lead_date)::date, source
ORDER BY month DESC, total_leads DESC;

COMMENT ON VIEW vw_marketing_summary IS 'Resumo mensal de marketing ROI por fonte';
