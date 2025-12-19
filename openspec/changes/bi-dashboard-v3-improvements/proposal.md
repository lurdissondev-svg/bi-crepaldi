# BI Dashboard v3 - Performance, Data, and UI Improvements

## Summary

This proposal addresses four critical improvements for the BI dashboard:

1. **Performance**: Significantly reduce perceived loading time when switching between tabs
2. **Missing Metrics**: Add important data from Bitrix24 and Belle Software APIs that aren't currently being used
3. **Marketing Intelligence**: Enhance the marketing dashboard with industry-standard KPIs inspired by best practices
4. **UI/Design Refresh**: Apply a Metabase + Power BI inspired visual identity to improve clarity and focus on numbers

## Motivation

### Current Pain Points

1. **Slow Tab Switching**: Users experience noticeable delays when clicking between dashboard tabs. Each tab triggers a full API request that waits for the entire response before displaying content.

2. **Incomplete Lead Metrics**: Critical metrics like `avgConversionDays` and `avgInProgressDays` are hardcoded to 0 (`dashboard.db.service.js:196-197`). The Bitrix24 API has `crm.stagehistory.list` endpoint that could provide accurate stage transition timing.

3. **Unused API Data**: Belle Software's `listagem_comercial_clientes` endpoint provides valuable customer lifetime data (ticketMedio, qtdAtendimentos, primeiroAtendimento, ultimoAtendimento) that isn't being used.

4. **Missing Marketing ROI**: Meta Ads configuration exists but ROAS (Return on Ad Spend) and CPL (Cost Per Lead) aren't being calculated or displayed.

5. **No Return Customer Tracking**: Bitrix24's IS_RETURN_CUSTOMER field isn't being tracked, preventing analysis of customer retention.

6. **Weak Visual Hierarchy**: KPI values compete visually, making it harder to prioritize the most critical numbers per dashboard.

7. **Inconsistent Presentation**: Cards, tables, and chart headers vary in density and emphasis, reducing scanability across pages.

8. **Outdated Visual Language**: The current style does not reflect a modern BI identity like Metabase or Power BI, which impacts perceived quality.

## Research Insights

Based on analysis of industry-leading marketing BI dashboards:

### Key Patterns Identified

1. **Funnel-Based Visualization**: Top marketing dashboards prioritize funnel views showing Lead → MQL → SQL → Opportunity → Customer progression with conversion rates at each stage

2. **Z-Pattern Visual Hierarchy**: KPIs at top, trend charts middle, detailed tables bottom

3. **Real-Time Indicators**: Dashboards show "last updated" timestamps and sync status prominently

4. **Comparative Metrics**: Period-over-period comparisons (vs previous month, vs same period last year)

5. **Attribution Modeling**: Multi-touch attribution for marketing channels beyond simple UTM tracking

### Essential Marketing KPIs Missing

- **ROAS** (Return on Ad Spend) = Revenue / Ad Spend
- **CPL** (Cost Per Lead) = Ad Spend / Number of Leads
- **CAC** (Customer Acquisition Cost) = Total Marketing Spend / New Customers
- **CLV** (Customer Lifetime Value) = Average Revenue per Customer × Average Customer Lifespan
- **Lead Quality Score** = Conversion Rate × Average Deal Value
- **Time to Conversion** = Days from Lead Creation to Successful Conversion

## Proposed Changes

### 1. Performance Improvements

#### 1.1 Parallel Data Prefetching
- Load all dashboard tabs data in parallel on initial page load
- Implement optimistic UI updates showing cached data immediately while fresh data loads

#### 1.2 Progressive Loading
- Show skeleton components immediately
- Load critical KPIs first, then charts, then detailed tables
- Implement streaming responses for large datasets

#### 1.3 Smart Caching Strategy
- Extend frontend cache to match backend (5 minutes)
- Implement stale-while-revalidate pattern
- Cache data by filter combination, not just route

### 2. New Metrics from Existing APIs

#### 2.1 Bitrix24 Enhancements
- **Stage History Tracking**: Use `crm.stagehistory.list` to calculate accurate conversion times
- **Return Customer Flag**: Track IS_RETURN_CUSTOMER for retention analysis
- **Lead Scoring**: Calculate lead quality based on source performance

#### 2.2 Belle Software Enhancements
- **Customer Lifetime Metrics**: Integrate `listagem_comercial_clientes` data
  - Average ticket value per customer
  - Total appointments per customer
  - First and last appointment dates
  - Items purchased history
- **Voucher Analytics**: Track voucher usage patterns

### 3. Marketing Dashboard Enhancements

#### 3.1 New KPI Cards
- ROAS calculation from Meta Ads spend and attributed revenue
- CPL by channel (Facebook, Google, Organic, etc.)
- Lead Quality Score per source
- Actual Time to Conversion (not hardcoded 0)

#### 3.2 Enhanced Visualizations
- Multi-stage conversion funnel with time between stages
- Channel attribution comparison chart
- Customer journey timeline
- ROI trend over time

### 4. UI/Design Refresh (Metabase + Power BI Inspired)

#### 4.1 Visual Identity System
- Define a neutral, high-contrast palette with a single accent color and status colors
- Update typography scale with stronger numeric emphasis (tabular numbers)
- Standardize card, table, and chart framing across all pages

#### 4.2 KPI Focus: Primary Metrics Per Page
Each dashboard will highlight 3 primary KPIs above the fold, with larger type and clear deltas.

| Page | Primary KPIs (Top 3) |
| --- | --- |
| Resumo | Faturamento total, Total de pacientes, Taxa de conversao de pacientes novos |
| Faturamento | Faturamento mensal, Crescimento mensal (%), Vendas de hoje (valor/quantidade) |
| Marketing | Total de leads, Taxa de conversao, ROAS (ou CPL quando ROAS indisponivel) |
| Comercial | Total faturado, Total de vendas, Taxa de conversao geral |
| Atendimento | Total faturamento, Percentual de aprovacao, Ticket medio geral |
| Metas | Faturamento total, Expectativa vs realidade (%), Dias restantes |
| Pacientes | Total de clientes, Clientes > 4 meses sem vir, Maior investimento por cliente |

#### 4.3 Layout and Readability
- Consistent layout rhythm: KPI strip, analysis row, detail row
- Charts with cleaner axes, tighter legends, and stronger data labels
- Tables with clearer density, sticky headers, and row-level emphasis on key values

## Impact

- Affected specs: dashboard-ui (new)
- Affected code: frontend styles, layout components, dashboard pages, chart/table components

## Success Criteria

1. **Performance**: Tab switching perceived as instant (<200ms to show content)
2. **Data Completeness**: All hardcoded values replaced with real calculations
3. **Marketing ROI**: ROAS and CPL visible on marketing dashboard
4. **KPI Focus**: Top 3 KPIs per page visible above the fold on desktop and mobile
5. **Visual Quality**: Consistent, BI-grade presentation aligned with Metabase/Power BI patterns

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bitrix24 API rate limits | Medium | Batch requests, use database cache |
| Belle API response times | Medium | Background sync, not real-time |
| Meta Ads token expiration | Low | Already handled in existing code |
| Database size growth | Low | Implement data retention policies |
| UI breaking changes for users | Medium | Document changes, maintain familiar patterns |
| Browser compatibility | Low | Test on Chrome, Firefox, Safari; use CSS fallbacks |
| Rollback complexity | Medium | Feature flags for new UI, keep old styles until stable |

