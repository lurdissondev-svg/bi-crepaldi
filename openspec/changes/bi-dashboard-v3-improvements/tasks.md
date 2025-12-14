# Implementation Tasks

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

## Phase 2: Bitrix24 Metrics Enhancement

### 2.1 Stage History Integration
- [ ] Add `crm.stagehistory.list` method to bitrix24.service.js
- [ ] Create sync job for stage_history table
- [ ] Create PostgreSQL table for stage transitions
- [ ] Calculate avg time between stages from history data

### 2.2 Conversion Time Calculation
- [ ] Query stage history for leads that reached success status
- [ ] Calculate days from NEW to each subsequent stage
- [ ] Update dashboard.db.service.js to use real calculations
- [ ] Add conversion time distribution chart

### 2.3 Return Customer Tracking
- [ ] Add IS_RETURN_CUSTOMER to leads sync
- [ ] Create returning vs new customer analytics
- [ ] Add retention rate KPI to dashboard

## Phase 3: Belle Software Data Integration

### 3.1 Customer Lifetime Metrics
- [ ] Implement `listagem_comercial_clientes` API call
- [ ] Create customers_analytics table
- [ ] Sync customer metrics (ticketMedio, qtdAtendimentos, etc.)
- [ ] Create CLV calculation based on historical data

### 3.2 Voucher Analytics
- [ ] Implement `uso_voucher` API call
- [ ] Track voucher redemption rates
- [ ] Correlate vouchers with lead sources

### 3.3 Replace Hardcoded Percentages
- [ ] Calculate real pacientesNovosPercentualMensal from data
- [ ] Calculate real pacientesNovosPercentualAnual from data
- [ ] Add first-time vs returning patient ratio

## Phase 4: Marketing Dashboard KPIs

### 4.1 Meta Ads Integration
- [ ] Fetch campaign spend from Meta Ads API
- [ ] Calculate ROAS: revenue / ad_spend
- [ ] Calculate CPL: ad_spend / leads_count
- [ ] Add ROAS/CPL KPI cards to MarketingPage

### 4.2 Lead Source Attribution
- [ ] Calculate conversion rate per source
- [ ] Calculate revenue per source
- [ ] Create lead quality score formula
- [ ] Add source performance comparison chart

### 4.3 Enhanced Funnel
- [ ] Add time-between-stages to funnel visualization
- [ ] Show drop-off percentages at each stage
- [ ] Add funnel comparison (this period vs previous)

### 4.4 New Visualizations
- [ ] Channel ROI comparison bar chart
- [ ] Conversion time histogram
- [ ] Customer journey sankey diagram
- [ ] Period-over-period trend lines

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
Phase 1 (Performance) - No dependencies, can start immediately
Phase 2 (Bitrix24) - Requires Phase 1 for optimal UX
Phase 3 (Belle) - Requires Phase 1 for optimal UX
Phase 4 (Marketing KPIs) - Requires Phase 2 & 3 for data
Phase 5 (Testing) - Requires all previous phases
```

## Database Migrations Required

1. `stage_history` - Bitrix24 lead stage transitions
2. `customers_analytics` - Belle customer lifetime data
3. `voucher_usage` - Voucher redemption tracking
4. `marketing_spend` - Meta Ads spend by campaign/date
