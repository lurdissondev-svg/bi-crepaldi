# Technical Design Document

## 1. Performance Architecture

### 1.1 Current Data Flow
```
User clicks tab → API request → Wait for response → Render
Average time: 2-5 seconds per tab
```

### 1.2 Proposed Data Flow
```
App loads → Parallel fetch all tabs → Cache locally → User clicks tab → Instant render
                                                    ↓
                                            Background revalidation
```

### 1.3 Implementation Details

#### Frontend Cache Layer (`src/services/cache.ts`)
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  filterHash: string;
}

class DashboardCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private TTL = 5 * 60 * 1000; // 5 minutes

  getFilterHash(filters: FilterState): string {
    return JSON.stringify(filters);
  }

  get<T>(key: string, filters: FilterState): T | null {
    const entry = this.cache.get(key);
    const filterHash = this.getFilterHash(filters);

    if (!entry) return null;
    if (entry.filterHash !== filterHash) return null;
    if (Date.now() - entry.timestamp > this.TTL) return null;

    return entry.data;
  }

  set<T>(key: string, data: T, filters: FilterState): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      filterHash: this.getFilterHash(filters),
    });
  }
}
```

#### Parallel Prefetch Strategy (`useDashboard.ts`)
```typescript
const prefetchAll = useCallback(async () => {
  const [resumo, faturamento, marketing, comercial, atendimento, metas, pacientes] =
    await Promise.allSettled([
      api.getResumo(filters),
      api.getFaturamento(filters),
      api.getMarketing(filters),
      api.getComercial(filters),
      api.getAtendimento(filters),
      api.getMetas(filters),
      api.getPacientes(filters),
    ]);

  // Update cache and state for successful responses
  if (resumo.status === 'fulfilled') cache.set('resumo', resumo.value, filters);
  // ... etc
}, [filters]);
```

## 2. Database Schema Extensions

### 2.1 Stage History Table
```sql
CREATE TABLE lead_stage_history (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  bitrix_lead_id VARCHAR(50) NOT NULL,
  from_status_id VARCHAR(50),
  to_status_id VARCHAR(50) NOT NULL,
  from_semantics VARCHAR(20),
  to_semantics VARCHAR(20),
  transition_time TIMESTAMP WITH TIME ZONE NOT NULL,
  time_in_previous_stage_hours DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_lead_stage_history_lead (lead_id),
  INDEX idx_lead_stage_history_bitrix (bitrix_lead_id),
  INDEX idx_lead_stage_history_time (transition_time)
);
```

### 2.2 Customer Analytics Table
```sql
CREATE TABLE customer_analytics (
  id SERIAL PRIMARY KEY,
  belle_customer_id VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255),
  email VARCHAR(255),
  telefone VARCHAR(50),
  primeiro_atendimento DATE,
  ultimo_atendimento DATE,
  qtd_atendimentos INTEGER DEFAULT 0,
  ticket_medio DECIMAL(12,2) DEFAULT 0,
  valor_total_gasto DECIMAL(12,2) DEFAULT 0,
  itens_comprados JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_customer_analytics_email (email),
  INDEX idx_customer_analytics_active (is_active)
);
```

### 2.3 Marketing Spend Table
```sql
CREATE TABLE marketing_spend (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL, -- 'meta_ads', 'google_ads', etc
  campaign_id VARCHAR(100),
  campaign_name VARCHAR(255),
  date DATE NOT NULL,
  spend DECIMAL(12,2) NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_attributed INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(source, campaign_id, date),
  INDEX idx_marketing_spend_date (date),
  INDEX idx_marketing_spend_source (source)
);
```

## 3. Bitrix24 Stage History Integration

### 3.1 API Endpoint
```javascript
// bitrix24.service.js
async getStageHistory(entityTypeId = 1, startDate, endDate) {
  // entityTypeId: 1 = Lead, 2 = Deal
  const result = await this.call('crm.stagehistory.list', {
    entityTypeId,
    filter: {
      '>=CREATED_TIME': startDate,
      '<=CREATED_TIME': endDate,
    },
    select: ['ID', 'TYPE_ID', 'OWNER_ID', 'CREATED_TIME', 'STAGE_SEMANTIC_ID', 'STAGE_ID'],
  });
  return result.result || [];
}
```

### 3.2 Sync Job Addition
```javascript
// sync.service.js
async syncLeadStageHistory() {
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const history = await bitrix24Service.getStageHistory(1, thirtyDaysAgo, today);

  for (const entry of history) {
    await db.query(`
      INSERT INTO lead_stage_history
        (bitrix_lead_id, to_status_id, to_semantics, transition_time)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [entry.OWNER_ID, entry.STAGE_ID, entry.STAGE_SEMANTIC_ID, entry.CREATED_TIME]);
  }
}
```

### 3.3 Conversion Time Calculation
```javascript
// dashboard.db.service.js
async getConversionMetrics(startDate, endDate) {
  const result = await db.query(`
    WITH conversion_times AS (
      SELECT
        l.bitrix_id,
        MIN(lsh.transition_time) FILTER (WHERE lsh.to_semantics = 'P') as first_progress_time,
        MIN(lsh.transition_time) FILTER (WHERE lsh.to_semantics = 'S') as conversion_time,
        l.bitrix_created_at
      FROM leads l
      JOIN lead_stage_history lsh ON l.bitrix_id::text = lsh.bitrix_lead_id
      WHERE l.bitrix_created_at >= $1 AND l.bitrix_created_at <= $2
      GROUP BY l.bitrix_id, l.bitrix_created_at
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM (conversion_time - bitrix_created_at)) / 86400)
        FILTER (WHERE conversion_time IS NOT NULL) as avg_conversion_days,
      AVG(EXTRACT(EPOCH FROM (NOW() - first_progress_time)) / 86400)
        FILTER (WHERE conversion_time IS NULL AND first_progress_time IS NOT NULL) as avg_in_progress_days
    FROM conversion_times
  `, [startDate, endDate]);

  return {
    avgConversionDays: parseFloat(result.rows[0]?.avg_conversion_days) || 0,
    avgInProgressDays: parseFloat(result.rows[0]?.avg_in_progress_days) || 0,
  };
}
```

## 4. Belle Software Integration

### 4.1 Customer Analytics API
```javascript
// belle.service.js
async getCustomerAnalytics(codEstab) {
  const url = `${this.baseUrl}/listagem_comercial_clientes`;
  const response = await this.client.get(url, {
    params: {
      cod_estab: codEstab,
      // Belle uses this endpoint for customer lifetime data
    },
  });
  return response.data;
}
```

### 4.2 CLV Calculation
```javascript
// dashboard.db.service.js
async getCustomerLifetimeValue() {
  const result = await db.query(`
    SELECT
      AVG(ticket_medio) as avg_ticket,
      AVG(qtd_atendimentos) as avg_visits,
      AVG(EXTRACT(DAYS FROM (ultimo_atendimento - primeiro_atendimento))) as avg_lifespan_days
    FROM customer_analytics
    WHERE is_active = true AND qtd_atendimentos > 1
  `);

  const row = result.rows[0];
  // CLV = Ticket Médio × Frequência Anual × Tempo de Vida (anos)
  const avgTicket = parseFloat(row.avg_ticket) || 0;
  const avgVisitsPerYear = ((parseFloat(row.avg_visits) || 0) / (parseFloat(row.avg_lifespan_days) || 365)) * 365;
  const avgLifespanYears = (parseFloat(row.avg_lifespan_days) || 365) / 365;

  return {
    avgTicket,
    avgVisitsPerYear,
    avgLifespanYears,
    clv: avgTicket * avgVisitsPerYear * avgLifespanYears,
  };
}
```

## 5. Marketing KPIs Implementation

### 5.1 ROAS Calculation
```javascript
// marketing.service.js
async calculateROAS(startDate, endDate) {
  // Get spend from marketing_spend table
  const spendResult = await db.query(`
    SELECT SUM(spend) as total_spend
    FROM marketing_spend
    WHERE date >= $1 AND date <= $2
  `, [startDate, endDate]);

  // Get revenue from converted leads in same period
  const revenueResult = await db.query(`
    SELECT SUM(cr.valor_liquido) as total_revenue
    FROM contas_receber cr
    JOIN leads l ON cr.cod_cliente = l.custom_fields->>'cliente_id'
    WHERE l.bitrix_created_at >= $1 AND l.bitrix_created_at <= $2
      AND l.status_semantica = 'success'
  `, [startDate, endDate]);

  const spend = parseFloat(spendResult.rows[0]?.total_spend) || 0;
  const revenue = parseFloat(revenueResult.rows[0]?.total_revenue) || 0;

  return {
    spend,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
  };
}
```

### 5.2 CPL by Source
```javascript
async calculateCPLBySource(startDate, endDate) {
  const result = await db.query(`
    WITH source_leads AS (
      SELECT
        COALESCE(utm_source, 'direct') as source,
        COUNT(*) as lead_count
      FROM leads
      WHERE bitrix_created_at >= $1 AND bitrix_created_at <= $2
      GROUP BY COALESCE(utm_source, 'direct')
    ),
    source_spend AS (
      SELECT
        source,
        SUM(spend) as total_spend
      FROM marketing_spend
      WHERE date >= $1 AND date <= $2
      GROUP BY source
    )
    SELECT
      sl.source,
      sl.lead_count,
      COALESCE(ss.total_spend, 0) as spend,
      CASE WHEN sl.lead_count > 0
        THEN COALESCE(ss.total_spend, 0) / sl.lead_count
        ELSE 0
      END as cpl
    FROM source_leads sl
    LEFT JOIN source_spend ss ON LOWER(sl.source) = LOWER(ss.source)
    ORDER BY lead_count DESC
  `, [startDate, endDate]);

  return result.rows;
}
```

## 6. Frontend Components

### 6.1 New KPI Cards for MarketingPage
```tsx
// New KPIs to add to MarketingPage.tsx grid
<KPICard
  title="ROAS"
  value={metricsData.roas}
  format="multiplier"  // Shows "2.5x"
  color="green"
  subtitle={`R$ ${metricsData.revenue.toLocaleString()} / R$ ${metricsData.spend.toLocaleString()}`}
/>

<KPICard
  title="CPL Médio"
  value={metricsData.avgCPL}
  format="currency"
  color="blue"
  subtitle="Custo por Lead"
/>

<KPICard
  title="CLV Estimado"
  value={metricsData.clv}
  format="currency"
  color="purple"
  subtitle="Valor Vitalício do Cliente"
/>
```

### 6.2 Source Performance Table
```tsx
const sourcePerformanceColumns = [
  { key: 'source', header: 'Fonte' },
  { key: 'lead_count', header: 'Leads' },
  { key: 'conversion_rate', header: 'Taxa Conversão', format: 'percentage' },
  { key: 'cpl', header: 'CPL', format: 'currency' },
  { key: 'roas', header: 'ROAS', format: 'multiplier' },
  { key: 'quality_score', header: 'Score', format: 'score' },
];
```

## 7. API Response Changes

### 7.1 Enhanced Marketing Response
```typescript
interface MarketingData {
  // Existing fields...

  // New fields
  metrics: {
    avgConversionDays: number;    // Real calculation, not 0
    avgInProgressDays: number;    // Real calculation, not 0
    totalConverted: number;
    totalDisqualified: number;
    roas: number;                  // NEW
    avgCPL: number;               // NEW
    clv: number;                  // NEW
  };

  sourcePerformance: Array<{      // NEW
    source: string;
    leadCount: number;
    conversionRate: number;
    cpl: number;
    roas: number;
    qualityScore: number;
  }>;

  conversionFunnel: Array<{
    stage: string;
    count: number;
    avgDaysInStage: number;       // NEW - real data
    dropOffRate: number;          // NEW
  }>;
}
```

## 8. Testing Strategy

### 8.1 Performance Benchmarks
```javascript
// tests/performance.test.js
describe('Dashboard Performance', () => {
  it('should load cached data in under 100ms', async () => {
    // First load populates cache
    await dashboardHook.prefetchAll();

    const start = performance.now();
    const data = cache.get('marketing', filters);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(data).toBeDefined();
  });
});
```

### 8.2 Calculation Accuracy
```javascript
describe('Conversion Time Calculation', () => {
  it('should calculate avg conversion days correctly', async () => {
    // Seed test data with known conversion times
    await seedTestLeadsWithHistory();

    const metrics = await dashboardDBService.getConversionMetrics(startDate, endDate);

    expect(metrics.avgConversionDays).toBeCloseTo(7.5, 1); // Known test value
  });
});
```
