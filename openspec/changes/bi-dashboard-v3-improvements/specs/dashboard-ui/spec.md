## ADDED Requirements

### Requirement: Unified dashboard visual identity
The dashboard UI SHALL apply a unified visual identity inspired by Metabase and Power BI across all dashboard pages and shared layout components.

#### Scenario: Consistent identity on every dashboard page
- **WHEN** a user opens any dashboard page
- **THEN** the header, sidebar, cards, tables, and charts use the dashboard UI theme tokens.

### Requirement: Primary KPI hierarchy
The dashboard UI SHALL present a primary KPI strip with three page-specific metrics prioritized for attention above the fold.

#### Scenario: Primary KPIs visible
- **WHEN** a user opens the Marketing dashboard
- **THEN** the top section shows the three primary KPIs defined for Marketing with the highest type scale.

### Requirement: KPI context and deltas
Each primary KPI SHALL show value, label, and contextual delta or unit when data is available.

#### Scenario: Monthly revenue comparison
- **WHEN** previous-period revenue is available
- **THEN** the KPI shows the current value and a delta indicator.

### Requirement: Layout rhythm and responsive hierarchy
The dashboard UI SHALL follow a consistent section order (KPI strip, analysis charts, detail tables) and preserve hierarchy on smaller viewports.

#### Scenario: Mobile layout
- **WHEN** the viewport is below the md breakpoint
- **THEN** sections stack while keeping the KPI strip first.

### Requirement: Vue framework retained
The UI refresh SHALL be implemented within the existing Vue 3 component architecture and Tailwind/CSS token system.

#### Scenario: Vue stack preserved
- **WHEN** the UI refresh is delivered
- **THEN** pages remain Vue components and routing remains unchanged.

---

## Design Tokens

### Color Palette
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--color-bg-page` | `#F8FAFC` | `#0F172A` | Page background |
| `--color-bg-surface` | `#FFFFFF` | `#1E293B` | Cards, panels |
| `--color-bg-elevated` | `#FFFFFF` | `#334155` | Dropdowns, modals |
| `--color-text-primary` | `#0F172A` | `#F1F5F9` | Headings, KPI values |
| `--color-text-secondary` | `#64748B` | `#94A3B8` | Labels, descriptions |
| `--color-accent` | `#3B82F6` | `#60A5FA` | Primary actions, links |
| `--color-success` | `#22C55E` | `#4ADE80` | Positive deltas |
| `--color-danger` | `#EF4444` | `#F87171` | Negative deltas, errors |
| `--color-warning` | `#F59E0B` | `#FBBF24` | Alerts |
| `--color-border` | `#E2E8F0` | `#334155` | Dividers, card borders |

### Typography Scale
| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-kpi-primary` | `2.25rem` (36px) | 700 | Primary KPI values |
| `--text-kpi-secondary` | `1.5rem` (24px) | 600 | Secondary KPI values |
| `--text-heading` | `1.125rem` (18px) | 600 | Section headings |
| `--text-body` | `0.875rem` (14px) | 400 | Body text, table cells |
| `--text-caption` | `0.75rem` (12px) | 400 | Labels, footnotes |

> All numeric values use `font-variant-numeric: tabular-nums` for alignment.

### Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Inline gaps |
| `--space-sm` | `8px` | Compact padding |
| `--space-md` | `16px` | Card padding, section gaps |
| `--space-lg` | `24px` | Page margins, major sections |
| `--space-xl` | `32px` | KPI strip vertical padding |

### Breakpoints
| Name | Min Width | Description |
|------|-----------|-------------|
| `sm` | `640px` | Mobile landscape |
| `md` | `768px` | Tablet |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Wide desktop |

### Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.08)` | Cards at rest |
| `--shadow-elevated` | `0 4px 12px rgba(0,0,0,0.12)` | Hover, dropdowns |

---

## Primary KPIs Per Dashboard Page

Each dashboard page highlights **3 primary KPIs** above the fold with larger typography and clear deltas.

| Page | KPI 1 (Primary) | KPI 2 (Primary) | KPI 3 (Primary) |
|------|-----------------|-----------------|-----------------|
| **Resumo** | Faturamento Total | Total de Pacientes | Taxa de Conversão de Pacientes Novos |
| **Faturamento** | Faturamento Mensal | Crescimento Mensal (%) | Vendas de Hoje (valor) |
| **Marketing** | Total de Leads | Taxa de Conversão | ROAS (ou CPL quando ROAS indisponível) |
| **Comercial** | Total Faturado | Total de Vendas | Taxa de Conversão Geral |
| **Atendimento** | Total Faturamento | Percentual de Aprovação | Ticket Médio Geral |
| **Metas** | Faturamento Total | Expectativa vs Realidade (%) | Dias Restantes |
| **Pacientes** | Total de Clientes | Clientes > 4 Meses Sem Retorno | Maior Investimento por Cliente |

### Implementation Guidelines

1. **KPI Strip Layout**: Use `KPIStrip.vue` component with `primaryCount` prop to define how many KPIs are primary
2. **Typography**: Primary KPIs use `text-4xl lg:text-5xl font-bold` for values
3. **Delta Indicators**: Show period-over-period change when data is available using `delta-chip-*` classes
4. **Responsive Behavior**: On mobile, KPIs stack vertically maintaining primary/secondary hierarchy
5. **Loading States**: Show skeleton loading per KPI, not per page
