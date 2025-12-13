# Tasks: Enhance Marketing BI with Meta Ads Integration

## Phase 1: Fix Data Accuracy and Remove Mocks
**Goal**: Tornar o BI 100% assertivo com dados reais

### Task 1.1: Remove Mock Data from MarketingPage
- [x] Remove `mockHorarioChegada` array
- [x] Remove `mockTaxaConversao` array
- [x] Remove `mockTotalLeads` array
- [x] Update component to use `data.marketing` from API
- [x] Add proper loading states during data fetch
- [x] Handle empty/error states gracefully
- **Validation**: Page loads real data from `/api/dashboard/marketing`

### Task 1.2: Fix Marketing Controller Data
- [x] Implement real `horarioChegada` from Bitrix leads
- [x] Calculate real `taxaConversaoPorOrigem` from lead statuses
- [x] Fix `totalLeads` distribution calculation
- [x] Remove hardcoded placeholder values
- **Validation**: API returns accurate lead metrics

### Task 1.3: Fix Patient Calculations in Resumo
- [x] Remove placeholder calculations for `pacienteRecorrente` (lines 49-52)
- [x] Implement real new vs recurring patient detection
- [x] Correlate Belle cliente data with Bitrix leads
- **Validation**: Patient metrics match real data

### Task 1.4: Fix Faturamento Placeholders
- [x] Remove hardcoded `pacientesNovosPercentualMensal` (line 166)
- [x] Remove hardcoded `pacientesNovosPercentualAnual` (line 167)
- [x] Calculate real percentages from correlated data
- **Validation**: All percentages are calculated from real data

### Task 1.5: Implement Data Validation Layer
- [x] Create `validators/dataValidator.js`
- [x] Add validation for Bitrix API responses
- [x] Add validation for Belle API responses
- [x] Implement graceful fallbacks for invalid data
- [x] Add structured logging for data issues
- **Validation**: Invalid data is caught and logged

---

## Phase 2: Enhance Marketing Dashboard
**Goal**: Fornecer métricas completas de marketing

### Task 2.1: Implement Conversion Funnel
- [x] Create `ConversionFunnel` component
- [x] Calculate funnel stages: Lead → Qualified → Scheduled → Attended → Converted
- [x] Add visual funnel chart (bar or funnel shape)
- [x] Show conversion rates between stages
- **Validation**: Funnel accurately reflects lead journey

### Task 2.2: Enhance UTM Tracking Analytics
- [x] Extend Bitrix service to fully parse UTM fields
- [x] Group analytics by UTM Source
- [x] Group analytics by UTM Campaign
- [x] Add UTM Medium breakdown
- [x] Create UTM analytics section in Marketing page
- **Validation**: UTM data properly categorized and displayed

### Task 2.3: Lead-to-Sale Correlation
- [x] Create `LeadSaleCorrelator` service
- [x] Match leads with Belle sales by phone number
- [x] Match leads with Belle sales by email (fallback)
- [x] Calculate ROI per lead source
- [x] Add revenue per source metrics
- **Validation**: Leads correctly linked to sales

### Task 2.4: Improve Lead Status Tracking
- [x] Map all Bitrix status semantics correctly
- [x] Track status transitions over time
- [x] Add "days in status" metric
- [x] Create status distribution chart
- **Validation**: Status tracking accurate and complete

---

## Phase 3: Meta Ads Module (Configuration)
**Goal**: Preparar estrutura para integração Meta Ads

### Task 3.1: Create Meta Ads Configuration Page
- [x] Add new route `/config/meta-ads`
- [x] Create `MetaAdsConfigPage.tsx` component
- [x] Design configuration form UI
- [x] Add form fields: App ID, App Secret, Access Token, Ad Account ID
- [x] Implement form validation
- **Validation**: Configuration page accessible and functional

### Task 3.2: Add Meta Ads to Sidebar Navigation
- [x] Add "Meta Ads" menu item in Sidebar
- [x] Add configuration icon
- [x] Add "Configurações" section in sidebar
- [x] Implement active state for new route
- **Validation**: Navigation works correctly

### Task 3.3: Create Meta Ads Backend Service
- [x] Create `services/meta.service.js`
- [x] Implement config save/load methods
- [x] Implement credential encryption
- [x] Create validation endpoint stub
- [x] Add environment variables for encryption key
- **Validation**: Backend service initializes without errors

### Task 3.4: Create Meta Ads Routes
- [x] Create `routes/meta.routes.js`
- [x] Add GET `/api/meta/config` endpoint
- [x] Add POST `/api/meta/config` endpoint
- [x] Add POST `/api/meta/validate` endpoint
- [x] Register routes in main app
- **Validation**: API endpoints respond correctly

### Task 3.5: Create Meta Ads Controller
- [x] Create `controllers/meta.controller.js`
- [x] Implement getConfig handler
- [x] Implement saveConfig handler
- [x] Implement validateConfig handler (stub for now)
- **Validation**: Controller handles requests properly

### Task 3.6: Frontend API Integration for Meta
- [x] Add Meta config types to `types/index.ts`
- [x] Add Meta API methods to `services/api.ts`
- [x] Connect config page to backend
- [x] Show configuration status indicator
- **Validation**: Frontend successfully saves/loads config

---

## Phase 4: Quality Assurance and Documentation
**Goal**: Garantir estabilidade e manutenibilidade

### Task 4.1: Add Error Handling
- [x] Implement global error boundary in React
- [x] Add try/catch to all API calls
- [x] Create user-friendly error messages
- [x] Add retry logic for transient failures
- **Validation**: Errors are caught and displayed properly

### Task 4.2: Add Health Checks
- [x] Extend `/api/health` with integration status
- [x] Check Bitrix24 connection
- [x] Check Belle Software connection
- [x] Check Meta Ads connection (when configured)
- [x] Add status indicators in UI
- **Validation**: Health endpoint shows accurate status

### Task 4.3: Update Documentation
- [x] Update README.md with new features
- [x] Document Meta Ads configuration steps
- [x] Document API endpoints
- [x] Add troubleshooting guide
- **Validation**: Documentation complete and accurate

### Task 4.4: Add Logging and Monitoring
- [x] Add structured logging for all API calls
- [x] Log data inconsistencies
- [x] Add timing metrics for slow queries
- [x] Create log rotation config
- **Validation**: Logs capture relevant information

---

## Dependency Graph

```
Phase 1 (Foundation)
├── Task 1.5 (Validation Layer) ──┐
├── Task 1.2 (Marketing Controller) ──┼── Task 1.1 (Remove Mocks)
├── Task 1.3 (Patient Calculations) ──┘
└── Task 1.4 (Faturamento Fixes) ────────────────────────┐
                                                          │
Phase 2 (Marketing Enhancement)                           │
├── Task 2.1 (Conversion Funnel) ◄────────────────────────┤
├── Task 2.2 (UTM Analytics) ◄────────────────────────────┤
├── Task 2.3 (Lead-Sale Correlation) ◄────────────────────┘
└── Task 2.4 (Status Tracking)

Phase 3 (Meta Ads Module)                    Parallel Track
├── Task 3.1 (Config Page) ─────────┐
├── Task 3.2 (Sidebar Nav) ─────────┤
│                                   │
├── Task 3.3 (Backend Service) ─────┼── Task 3.6 (Frontend Integration)
├── Task 3.4 (Routes) ──────────────┤
└── Task 3.5 (Controller) ──────────┘

Phase 4 (QA) - After all above
├── Task 4.1 (Error Handling)
├── Task 4.2 (Health Checks)
├── Task 4.3 (Documentation)
└── Task 4.4 (Logging)
```

## Estimated Complexity

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | 5 | Medium |
| Phase 2 | 4 | High |
| Phase 3 | 6 | Medium |
| Phase 4 | 4 | Low |
| **Total** | **19** | - |

## Definition of Done

- [x] All mock data removed from codebase
- [x] All API endpoints returning real data
- [x] Meta Ads configuration page functional
- [x] Error handling implemented
- [x] Health checks passing
- [x] Documentation updated
- [ ] No TypeScript/ESLint errors
- [ ] Manual testing completed on all pages
