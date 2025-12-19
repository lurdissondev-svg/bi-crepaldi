-- ============================================================
-- BI CREPALDI - Return Customer Tracking
-- Migration: 011
-- Description: Add is_return_customer field to leads for retention analysis
-- ============================================================

-- Add is_return_customer column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_return_customer BOOLEAN DEFAULT FALSE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_leads_return_customer ON leads(is_return_customer) WHERE is_return_customer = TRUE;

-- Add column to track when return customer status was calculated
ALTER TABLE leads ADD COLUMN IF NOT EXISTS return_customer_checked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN leads.is_return_customer IS 'Indicates if this lead is from a returning customer (matched by phone/email with existing customer)';
COMMENT ON COLUMN leads.return_customer_checked_at IS 'Timestamp when return customer status was last calculated';

-- Create a function to update is_return_customer based on customer analytics match
CREATE OR REPLACE FUNCTION update_lead_return_customer_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the lead's phone or email matches an existing customer with purchases
    NEW.is_return_customer := EXISTS (
        SELECT 1
        FROM customer_analytics ca
        WHERE ca.is_active = TRUE
        AND ca.qtd_atendimentos > 0
        AND (
            -- Match by phone
            EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(NEW.telefones) AS phone
                WHERE ca.telefone IS NOT NULL
                AND regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(ca.telefone, '[^0-9]', '', 'g')
            )
            -- Match by email
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(NEW.emails) AS email
                WHERE ca.email IS NOT NULL
                AND LOWER(email) = LOWER(ca.email)
            )
        )
    );
    NEW.return_customer_checked_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update return customer status on lead insert/update
-- (Only if customer_analytics table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_analytics') THEN
        DROP TRIGGER IF EXISTS trg_update_lead_return_customer ON leads;
        CREATE TRIGGER trg_update_lead_return_customer
            BEFORE INSERT OR UPDATE OF telefones, emails ON leads
            FOR EACH ROW
            EXECUTE FUNCTION update_lead_return_customer_status();
    END IF;
END;
$$;

-- Create a view for return customer analytics
CREATE OR REPLACE VIEW vw_return_customer_stats AS
SELECT
    DATE_TRUNC('month', bitrix_created_at) AS month,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE is_return_customer = TRUE) AS return_customer_leads,
    COUNT(*) FILTER (WHERE is_return_customer = FALSE OR is_return_customer IS NULL) AS new_customer_leads,
    ROUND(
        COUNT(*) FILTER (WHERE is_return_customer = TRUE)::DECIMAL /
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS return_customer_rate
FROM leads
WHERE bitrix_created_at IS NOT NULL
GROUP BY DATE_TRUNC('month', bitrix_created_at)
ORDER BY month DESC;

COMMENT ON VIEW vw_return_customer_stats IS 'Monthly breakdown of returning vs new customer leads';
