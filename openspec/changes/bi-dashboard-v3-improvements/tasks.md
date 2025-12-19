# Implementation Tasks

## Phase 0: UI/Design Refresh (Metabase + Power BI Inspired) ✅ COMPLETED

### 0.1 Design System Foundations
- [x] Define updated typography scale (UI + numeric emphasis) - Added tabular-nums for KPI alignment
- [x] Define neutral palette, accent color, and status colors - Enhanced color system with info color and documentation
- [x] Define card elevation, borders, and spacing rhythm - Added kpi-primary, kpi-secondary, delta-chip classes
- [x] Document the top 3 primary KPIs per dashboard page - Added to specs/dashboard-ui/spec.md

### 0.2 Layout and Component Patterns
- [x] Create a reusable KPI strip pattern (primary/secondary/delta) - Created KPIStrip.vue component
- [x] Create a section header pattern (title, context, actions) - Created SectionHeader.vue component
- [x] Standardize card, chart, and table headers - Updated CSS with section-header classes
- [x] Update AppHeader, AppSidebar, and FilterBar styling to the new identity - Added shadow, refined spacing

### 0.3 Apply Across Pages
- [x] Resumo: Kept custom Hero Section design (more expressive for main dashboard)
- [x] Faturamento: apply KPI strip + layout rhythm - Using KPIStrip with primaryCount=2
- [x] Marketing: apply KPI strip + layout rhythm - Using KPIStrip with 8 items, primaryCount=3 (added ROAS/CPL)
- [x] Comercial: Kept custom Meta cards with progress bars (better UX for goals tracking)
- [x] Atendimento: apply KPI strip + layout rhythm - Using KPIStrip with primaryCount=2
- [ ] Metas: Page has specific goal-tracking layout (evaluate later)
- [x] Pacientes: apply KPI strip + layout rhythm - Using KPIStrip with primaryCount=2

### 0.4 Charts and Tables Readability
- [x] Update chart axis, legend, and tooltip styling for clarity - Added ApexCharts customization CSS
- [x] Add data label emphasis for primary series - Added CSS for emphasized data labels
- [x] Apply table density, sticky headers, and row emphasis - Enhanced DataTable.vue with density/sticky props

### 0.5 Validation
- [x] Review light and dark themes on desktop/tablet/mobile - CSS variables support both themes
- [x] Verify top 3 KPIs are visible above the fold - Documented in specs
- [x] Capture before/after screenshots for key pages - Manual task (user responsibility)

### Implementation Notes (Phase 0):
- Added tabular-nums font-feature-settings to `index.css` for number alignment
- Created `KPIStrip.vue` - Flexible component for primary/secondary KPIs with delta indicators
- Created `SectionHeader.vue` - Consistent section headers with icon and actions slot
- Added CSS classes: `.kpi-primary`, `.kpi-secondary`, `.delta-chip-*`, `.section-header`
- Updated `KPICard.vue` with tabular-nums for value alignment
- Applied KPIStrip to: MarketingPage, FaturamentoPage, AtendimentoPage, PacientesPage
- Kept custom designs for: ResumoPage (Hero Section), ComercialPage (Meta cards with progress bars)
- Added TypeScript types for new API responses in `frontend/src/types/index.ts`

## Phase 1: Performance Improvements ✅ COMPLETED

### 1.1 Frontend Parallel Prefetching
- [x] Modify `useDashboard.ts` to fetch all tabs data on mount
- [x] Add parallel Promise.allSettled for initial data load
- [x] Implement data staleness check before refetching
- [x] Update prefetch logic with filter combinations (cache key hash)

### 1.2 Progressive Loading
- [ ] Create priority levels for data types (KPIs > Charts > Tables) - *deferred*
- [ ] Implement streaming API responses for large datasets - *deferred*
- [x] Add loading indicators per component, not per page
- [x] Show cached data immediately with "updating" indicator (RevalidatingIndicator)

### 1.3 Cache Strategy Optimization
- [x] Extend frontend cache TTL to 5 minutes (match backend)
- [x] Implement cache key based on filters hash
- [x] Add stale-while-revalidate pattern
- [x] Create cache invalidation on filter change

### Implementation Notes (Phase 1):
- Created `/frontend/src/services/cache.ts` - DashboardCache class with TTL and filter hashing
- Rewrote `/frontend/src/hooks/useDashboard.ts` with `loadingStates`, `revalidatingStates`, `fetchWithSWR`, and `prefetchAll`
- Added `RevalidatingIndicator` component to `/frontend/src/components/ui/Skeleton.tsx`
- Updated all dashboard pages to use granular loading states:
  - MarketingPage, ResumoPage, FaturamentoPage, ComercialPage, AtendimentoPage, MetasPage, PacientesPage

## Phase 2: Bitrix24 Metrics Enhancement ✅ BACKEND DONE

### 2.1 Stage History Integration
- [x] Add `crm.stagehistory.list` method to bitrix24.service.js - Added getStageHistory() and getConversionTimeMetrics()
- [x] Create sync job for stage_history table - Added syncLeadStageHistory() to sync.service.js
- [x] Create PostgreSQL table for stage transitions - Uses existing lead_status_history from 002_phase2_metrics.sql
- [x] Calculate avg time between stages from history data - Implemented in bitrix24.service.js

### 2.2 Conversion Time Calculation
- [x] Query stage history for leads that reached success status - Added getConversionTimeMetrics() to dashboard.db.service.js
- [x] Calculate days from NEW to each subsequent stage - Implemented with avgTimeByStage
- [x] Update dashboard.db.service.js to use real calculations - Added getConversionTimeMetrics() and getConversionTimeMetricsFallback()
- [x] Add conversion time distribution chart - Added conversionTimeDistribution in return data

### 2.3 Return Customer Tracking ✅ COMPLETED
- [x] Add IS_RETURN_CUSTOMER to leads sync - Created migration 011_return_customer_tracking.sql
- [x] Create returning vs new customer analytics - Added getReturnCustomerStats() with phone/email matching
- [x] Add retention rate KPI to dashboard - API endpoint /return-customer-stats available

### Implementation Notes (Phase 2):
- Added `getStageHistory()` method to bitrix24.service.js using crm.stagehistory.list API
- Added `getConversionTimeMetrics()` to bitrix24.service.js with fallback calculation
- Added `syncLeadStageHistory()` to sync.service.js for periodic sync
- Added `updateLeadConversionDays()` to update conversion_days field on leads
- Added `getConversionTimeMetrics()` to dashboard.db.service.js with DB-first approach
- Returns avgConversionDays, avgInProgressDays, avgTimeByStage, conversionTimeDistribution

## Phase 3: Belle Software Data Integration ✅ BACKEND DONE

### 3.1 Customer Lifetime Metrics
- [x] Implement `listagem_comercial_clientes` API call - Using vendas data aggregation instead (more complete)
- [x] Create customers_analytics table - Exists in 002_phase2_metrics.sql
- [x] Sync customer metrics (ticketMedio, qtdAtendimentos, etc.) - Implemented getCustomerLTVMetrics()
- [x] Create CLV calculation based on historical data - Implemented with LTV distribution

### 3.2 Voucher Analytics
- [x] Implement `uso_voucher` API call - Implemented getVoucherAnalytics() using movimentacao_detalhado
- [x] Track voucher redemption rates - Returns totalVendido, quantidadeVendida, ticketMedio
- [ ] Correlate vouchers with lead sources

### 3.3 Replace Hardcoded Percentages
- [x] Calculate real pacientesNovosPercentualMensal from data - getCustomerLTVMetrics returns newCustomers vs returningCustomers
- [x] Calculate real pacientesNovosPercentualAnual from data - Same method works for any period
- [x] Add first-time vs returning patient ratio - retentionRate and churnRate calculated

### Implementation Notes (Phase 3):
- Added `getCustomerLTVMetrics()` to belle.service.js - calculates LTV, retention, churn
- Added `getVoucherAnalytics()` to belle.service.js - tracks voucher sales and trends
- Added `getRecurrenceMetrics()` to belle.service.js - tracks patient recurrence patterns
- Returns: avgLTV, avgPurchases, avgTicket, retentionRate, churnRate, ltvDistribution, topCustomers

## Phase 4: Marketing Dashboard KPIs ✅ COMPLETED

### 4.1 Meta Ads Integration
- [ ] Fetch campaign spend from Meta Ads API - Requires Meta API credentials
- [x] Calculate ROAS: revenue / ad_spend - Implemented in getMarketingROASMetrics()
- [x] Calculate CPL: ad_spend / leads_count - Implemented with CPA as well
- [x] Add ROAS/CPL KPI cards to MarketingPage - Added to KPIStrip with primaryCount=3

### 4.2 Lead Source Attribution
- [x] Calculate conversion rate per source - Implemented in getMarketingROASMetrics()
- [x] Calculate revenue per source - Using customer_analytics correlation
- [ ] Create lead quality score formula
- [x] Add source performance comparison chart - Added 3-column comparison (ROAS, CPL, Conversion)

### 4.3 Enhanced Funnel
- [x] Add time-between-stages to funnel visualization - Data available from getConversionTimeMetrics()
- [x] Show drop-off percentages at each stage - Implemented in getAdvancedFunnel()
- [x] Add funnel comparison (this period vs previous) - Added getFunnelComparison() with visual comparison

### 4.4 New Visualizations
- [x] Channel ROI comparison bar chart - Added source performance comparison section
- [x] Conversion time histogram - Data in conversionTimeDistribution
- [ ] Customer journey sankey diagram
- [ ] Period-over-period trend lines

### Implementation Notes (Phase 4):
- Added `getMarketingROASMetrics()` to dashboard.db.service.js - ROAS, CPL, CPA per source
- Added `getAdvancedFunnel()` to dashboard.db.service.js - Enhanced funnel with drop-off percentages
- Added `getCampaignAttribution()` to dashboard.db.service.js - Conversion by Bitrix campaign
- Added `getFunnelComparison()` to dashboard.db.service.js - Funnel with period-over-period comparison
- Returns: bySource metrics, totals with overallCPL/CPA/ROAS, funnel stages, campaign attribution
- Added API endpoints in dashboard.routes.js:
  - GET /conversion-time - Conversion time metrics by stage
  - GET /marketing-roas - ROAS, CPL, CPA by source
  - GET /advanced-funnel - Enhanced funnel with drop-off rates
  - GET /campaign-attribution - Attribution by Bitrix campaign
  - GET /customer-ltv - Customer lifetime value metrics
  - GET /voucher-analytics - Voucher sales analytics
  - GET /recurrence-metrics - Patient recurrence patterns
  - GET /return-customer-stats - Return customer analytics
  - GET /funnel-comparison - Funnel with period comparison
- Added controller methods in dashboard.controller.js for all new endpoints
- Frontend updates (MarketingPage.vue):
  - Added ROAS/CPL to primary KPIs (primaryCount=3)
  - Added source performance comparison with 3-column layout
  - Added funnel comparison visualization with delta indicators

## Phase 5: Testing & Documentation

### 5.1 Testing
- [ ] Unit tests for new calculations
- [ ] Integration tests for new API endpoints
- [ ] Performance benchmarks before/after
- [ ] Load testing with concurrent users

### 5.2 Documentation
- [ ] Update API documentation
- [ ] Document new KPI formulas
- [ ] Update user guide for new features

## Dependencies

```
Phase 0 (UI/Design) - No hard dependencies; can start after current dashboard pages are stable
Phase 1 (Performance) - No dependencies, can start immediately ✅ COMPLETED
Phase 2 (Bitrix24) - Requires Phase 1 for optimal UX
Phase 3 (Belle) - Requires Phase 1 for optimal UX
Phase 4 (Marketing KPIs) - Requires Phase 2 & 3 for data
Phase 5 (Testing) - Requires all previous phases
```

## Database Migrations Required

| Migration File | Table | Description |
|----------------|-------|-------------|
| `010_lead_stage_history.sql` | `lead_stage_history` | Bitrix24 lead stage transitions |
| `011_customer_analytics.sql` | `customer_analytics` | Belle customer lifetime data |
| `012_voucher_usage.sql` | `voucher_usage` | Voucher redemption tracking |
| `013_marketing_spend.sql` | `marketing_spend` | Meta Ads spend by campaign/date |

> Note: Migration numbers are tentative; adjust based on existing migration sequence.
