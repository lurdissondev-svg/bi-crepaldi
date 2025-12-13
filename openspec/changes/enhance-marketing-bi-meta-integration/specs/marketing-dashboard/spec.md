# Spec: Marketing Dashboard Enhancement

## Overview
Aprimoramento do dashboard de marketing com métricas avançadas de conversão, funil e tracking UTM completo.

---

## MODIFIED Requirements

### Requirement: Marketing Page Data Source
A página de marketing MUST consumir exclusivamente dados da API backend.

#### Scenario: Display Hourly Lead Chart
**Given** o usuário está na página de Marketing
**When** os dados são carregados
**Then** o gráfico de barras exibe `data.marketing.horarioChegada` da API
**And** o eixo X mostra horas de 00:00 a 23:00
**And** o eixo Y mostra quantidade de leads
**And** nenhum dado mockado é utilizado

#### Scenario: Display Conversion Table
**Given** o usuário está na página de Marketing
**When** a tabela de conversão é renderizada
**Then** os dados vêm de `data.marketing.origemLead.taxaConversaoPorOrigem`
**And** cada linha mostra: origem, leads, em atendimento, desqualificados, agendou, taxa
**And** a taxa de conversão é calculada pelo backend

#### Scenario: Display Lead Distribution Pie Chart
**Given** o usuário está na página de Marketing
**When** o gráfico de pizza é renderizado
**Then** mostra distribuição real de `data.marketing.origemLead.totalLeads`
**And** categorias incluem: Sem Preenchimento, Iniciativa Interna, Outros
**And** percentuais somam 100%

---

## ADDED Requirements

### Requirement: Conversion Funnel
O dashboard MUST exibir um funil de conversão visual.

#### Scenario: Display Conversion Funnel
**Given** existem leads no período selecionado
**When** o funil é renderizado
**Then** exibe estágios: Total Leads → Qualificados → Agendados → Atendidos → Convertidos
**And** cada estágio mostra quantidade e percentual do anterior
**And** cores indicam saúde da conversão (verde > 50%, amarelo 20-50%, vermelho < 20%)

#### Scenario: Funnel Empty State
**Given** não existem leads no período
**When** o funil é renderizado
**Then** exibe mensagem "Nenhum lead encontrado no período"
**And** sugere expandir o filtro de datas

### Requirement: UTM Analytics Section
O dashboard MUST exibir análise detalhada de parâmetros UTM.

#### Scenario: Display UTM Source Breakdown
**Given** existem leads com parâmetros UTM
**When** a seção UTM é exibida
**Then** agrupa leads por UTM_SOURCE
**And** mostra para cada fonte: total, convertidos, taxa de conversão
**And** ordena por volume de leads (decrescente)

#### Scenario: Display UTM Campaign Details
**Given** o usuário clica em uma fonte UTM
**When** os detalhes são expandidos
**Then** mostra campanhas (UTM_CAMPAIGN) daquela fonte
**And** exibe métricas por campanha
**And** permite drill-down para anúncios específicos

#### Scenario: Handle Missing UTM Data
**Given** existem leads sem parâmetros UTM
**When** a análise é exibida
**Then** leads sem UTM são agrupados em "Origem Direta/Desconhecida"
**And** exibe percentual de leads sem tracking
**And** sugere melhoria no tracking se > 30%

### Requirement: Lead Status Timeline
O dashboard MUST mostrar evolução dos leads ao longo do tempo.

#### Scenario: Display Daily Lead Status
**Given** existem leads no período de 30 dias
**When** o gráfico de timeline é exibido
**Then** mostra leads novos por dia
**And** mostra leads convertidos por dia
**And** permite comparação visual da tendência

### Requirement: Lead Quality Score
O dashboard MUST indicar qualidade dos leads por fonte.

#### Scenario: Calculate Lead Quality Score
**Given** existem leads com histórico de conversão
**When** o score é calculado
**Then** score = (conversões / total) * peso_conversao + (agendamentos / total) * peso_agendamento
**And** score é exibido como badge na tabela de origens
**And** cores indicam: verde (>70), amarelo (40-70), vermelho (<40)

---

## UI Components

### ConversionFunnel Component
```tsx
interface ConversionFunnelProps {
  data: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  title?: string;
  showLabels?: boolean;
}
```

### UTMAnalytics Component
```tsx
interface UTMAnalyticsProps {
  bySource: UTMSourceData[];
  byCampaign: UTMCampaignData[];
  expandable?: boolean;
}
```

### LeadQualityBadge Component
```tsx
interface LeadQualityBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}
```

---

## Technical Notes

### Lead Status Mapping
| Bitrix Status | Display Name | Category |
|---------------|--------------|----------|
| NEW | Novo | Leads |
| IN_PROGRESS | Em Atendimento | Qualificados |
| PROCESSED | Agendado | Agendados |
| CONVERTED | Convertido | Convertidos |
| JUNK | Desqualificado | Perdidos |

### UTM Parameter Priority
1. UTM_SOURCE (obrigatório para tracking)
2. UTM_CAMPAIGN (recomendado)
3. UTM_MEDIUM (opcional)
4. UTM_CONTENT (opcional)
5. UTM_TERM (opcional)
