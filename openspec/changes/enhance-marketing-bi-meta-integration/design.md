# Design: Enhance Marketing BI with Meta Ads Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  Marketing  │  │  Comercial  │  │   Resumo    │  │  Meta Ads Config │   │
│  │    Page     │  │    Page     │  │    Page     │  │      (NEW)       │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
│         │                │                │                   │            │
│         └────────────────┴────────────────┴───────────────────┘            │
│                                   │                                         │
│                          ┌────────▼────────┐                               │
│                          │   API Service   │                               │
│                          │   (api.ts)      │                               │
│                          └────────┬────────┘                               │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ HTTP
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                              BACKEND (Node.js)                              │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                          ┌────────▼────────┐                               │
│                          │     Routes      │                               │
│                          │  /api/dashboard │                               │
│                          │  /api/meta (NEW)│                               │
│                          └────────┬────────┘                               │
│                                   │                                         │
│                          ┌────────▼────────┐                               │
│                          │   Controllers   │                               │
│                          │ - dashboard     │                               │
│                          │ - meta (NEW)    │                               │
│                          └────────┬────────┘                               │
│                                   │                                         │
│         ┌─────────────────────────┼─────────────────────────────┐          │
│         │                         │                             │          │
│  ┌──────▼──────┐          ┌──────▼──────┐           ┌──────────▼────────┐ │
│  │   Bitrix24  │          │    Belle    │           │   Meta Ads (NEW)  │ │
│  │   Service   │          │   Service   │           │      Service      │ │
│  └──────┬──────┘          └──────┬──────┘           └──────────┬────────┘ │
│         │                        │                              │          │
│         │                        │                              │          │
│  ┌──────▼──────┐          ┌──────▼──────┐           ┌──────────▼────────┐ │
│  │   LeadData  │          │  SalesData  │           │    CampaignData   │ │
│  │ Transformer │          │ Transformer │           │    Transformer    │ │
│  │    (NEW)    │          │    (NEW)    │           │      (NEW)        │ │
│  └─────────────┘          └─────────────┘           └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL APIS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────────────────┐   │
│  │  Bitrix24   │       │   Belle     │       │    Facebook Graph API   │   │
│  │  REST API   │       │  Software   │       │   (Future Integration)  │   │
│  └─────────────┘       └─────────────┘       └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Lead to Sale Correlation

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         LEAD TRACKING FLOW                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Meta Ads Campaign                                                    │
│     ├── utm_source: facebook/instagram                                   │
│     ├── utm_medium: cpc/cpm                                              │
│     ├── utm_campaign: campaign_name                                      │
│     └── utm_content: ad_id                                               │
│                        │                                                  │
│                        ▼                                                  │
│  2. Landing Page → Form Submission                                       │
│     └── UTM params captured                                              │
│                        │                                                  │
│                        ▼                                                  │
│  3. Bitrix24 Lead Created                                                │
│     ├── UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN stored                     │
│     ├── STATUS_ID: NEW → IN_PROGRESS → CONVERTED                        │
│     └── Lead ID generated                                                │
│                        │                                                  │
│                        ▼                                                  │
│  4. Deal Created (on conversion)                                         │
│     ├── Linked to original Lead                                          │
│     ├── STAGE_ID: NEW → WON                                              │
│     └── UTM data inherited                                               │
│                        │                                                  │
│                        ▼                                                  │
│  5. Belle Software Sale                                                  │
│     ├── Cliente created/updated                                          │
│     ├── Venda registered                                                 │
│     └── Conta Receber generated                                          │
│                        │                                                  │
│                        ▼                                                  │
│  6. BI Correlation                                                       │
│     ├── Match by: phone/email/name                                       │
│     ├── Calculate: Lead → Deal → Sale conversion                        │
│     └── Report: ROI by campaign                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Marketing Dashboard Enhancement

```typescript
// Frontend: MarketingPage.tsx improvements

interface MarketingMetrics {
  // Dados reais da API (sem mocks)
  horarioChegada: HourlyLeadData[];
  taxaConversao: ConversionBySource[];
  totalLeads: LeadDistribution;
  utmAnalytics: UTMAnalytics;
  funilConversao: ConversionFunnel;
}

interface ConversionFunnel {
  leads: number;           // Total leads criados
  qualified: number;       // Leads qualificados (em atendimento)
  scheduled: number;       // Leads agendados
  attended: number;        // Leads atendidos
  converted: number;       // Leads convertidos em venda
  revenue: number;         // Faturamento total
}

interface UTMAnalytics {
  bySource: {
    source: string;
    leads: number;
    conversions: number;
    revenue: number;
    cost: number;          // Futuro: vindo do Meta Ads
    roi: number;           // Futuro: calculado
  }[];
  byCampaign: {
    campaign: string;
    source: string;
    leads: number;
    conversions: number;
    revenue: number;
  }[];
}
```

### 2. Meta Ads Configuration Module

```typescript
// Frontend: pages/MetaAdsConfigPage.tsx (NEW)

interface MetaAdsConfig {
  appId: string;
  appSecret: string;       // Encrypted storage
  accessToken: string;     // Short-lived or long-lived
  adAccountId: string;
  pixelId?: string;
  status: 'configured' | 'pending' | 'error';
  lastSync?: string;
}

interface MetaAdsMetrics {
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  insights: CampaignInsights;
}

interface CampaignInsights {
  dateRange: { start: string; end: string };
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;           // Form submissions
  costPerLead: number;
  conversions: number;     // Matched with Bitrix
}
```

### 3. Backend Service Layer

```javascript
// backend/src/services/meta.service.js (NEW)

class MetaAdsService {
  constructor() {
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  // Configuration management
  async saveConfig(config) { /* Store encrypted */ }
  async getConfig() { /* Retrieve and decrypt */ }
  async validateCredentials() { /* Test API connection */ }

  // Data fetching (future implementation)
  async getCampaigns(dateRange) { /* Graph API call */ }
  async getAdInsights(dateRange) { /* Graph API call */ }
  async syncWithBitrix(leads) { /* Match UTM data */ }
}
```

### 4. Data Transformation Layer

```javascript
// backend/src/transformers/leadDataTransformer.js (NEW)

class LeadDataTransformer {
  // Normalize Bitrix lead data
  normalizeLeadStatus(status, semantics) {
    const statusMap = {
      'NEW': 'novo',
      'IN_PROGRESS': 'em_atendimento',
      'PROCESSED': 'agendado',
      'CONVERTED': 'convertido',
      'JUNK': 'desqualificado',
    };
    return statusMap[status] || 'desconhecido';
  }

  // Calculate real conversion metrics
  calculateConversionRate(leads) {
    const total = leads.length;
    const converted = leads.filter(l =>
      this.normalizeLeadStatus(l.STATUS_ID) === 'convertido'
    ).length;

    return {
      total,
      converted,
      rate: total > 0 ? (converted / total * 100).toFixed(2) : 0,
    };
  }

  // Correlate with Belle sales
  correlateWithSales(leads, sales, matchBy = 'phone') {
    return leads.map(lead => {
      const matchedSale = sales.find(sale =>
        this.matchRecord(lead, sale, matchBy)
      );
      return {
        ...lead,
        sale: matchedSale || null,
        converted: !!matchedSale,
        revenue: matchedSale?.valor_venda || 0,
      };
    });
  }
}
```

## Database Schema (Future - if needed)

```sql
-- Meta Ads Configuration
CREATE TABLE meta_ads_config (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(255) NOT NULL,
  app_secret_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  ad_account_id VARCHAR(255) NOT NULL,
  pixel_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cached Campaign Data
CREATE TABLE meta_campaigns_cache (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(255) UNIQUE NOT NULL,
  campaign_name VARCHAR(255),
  status VARCHAR(50),
  objective VARCHAR(100),
  spend DECIMAL(10,2),
  impressions INTEGER,
  clicks INTEGER,
  leads INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead to Sale Correlation
CREATE TABLE lead_sale_correlation (
  id SERIAL PRIMARY KEY,
  bitrix_lead_id VARCHAR(255) NOT NULL,
  belle_sale_id VARCHAR(255),
  utm_source VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_content VARCHAR(255),
  matched_by VARCHAR(50),
  match_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Existing (to be fixed)

| Method | Endpoint | Status | Fix Required |
|--------|----------|--------|--------------|
| GET | /api/dashboard/resumo | Partial | Remove placeholders |
| GET | /api/dashboard/faturamento | Working | Add validation |
| GET | /api/dashboard/marketing | Broken | Remove mocks, fix data |
| GET | /api/dashboard/comercial | Partial | Fix calculations |
| GET | /api/dashboard/atendimento | Working | Add validation |
| GET | /api/dashboard/metas | Placeholder | Implement real data |
| GET | /api/dashboard/pacientes | Working | Optimize queries |
| GET | /api/dashboard/filtros | Working | Add caching |

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/meta/config | Get Meta Ads configuration status |
| POST | /api/meta/config | Save Meta Ads credentials |
| POST | /api/meta/validate | Test Graph API connection |
| GET | /api/meta/campaigns | Get campaign list (future) |
| GET | /api/meta/insights | Get ad insights (future) |
| POST | /api/meta/sync | Sync campaigns with Bitrix (future) |

## Security Considerations

1. **Credential Storage**
   - Use AES-256 encryption for API tokens
   - Store encryption key in environment variables
   - Never log sensitive credentials

2. **API Access**
   - Rate limiting on all endpoints
   - Input validation and sanitization
   - CORS properly configured

3. **Meta Ads Integration**
   - OAuth flow for token generation
   - Token refresh automation
   - Minimal required permissions

## Performance Optimizations

1. **Caching Strategy**
   - Cache TTL: 5 minutes for dashboard data
   - Cache TTL: 1 hour for filter options
   - Cache TTL: 24 hours for campaign data

2. **Query Optimization**
   - Parallel API calls where possible
   - Pagination for large datasets
   - Chunked date ranges for Belle API (3-month limit)

3. **Frontend Optimization**
   - Lazy loading for pages
   - Skeleton loading states
   - Debounced filter changes
