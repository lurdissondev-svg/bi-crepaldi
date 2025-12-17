# Design: Corrigir páginas do Dashboard após migração para Vue

## Overview

Este documento detalha a estrutura de dados esperada pela API versus a implementação atual, e define como cada página deve ser corrigida.

---

## Mapeamento de Dados por Página

### 1. FaturamentoPage.vue

#### Estrutura da API (`FaturamentoData`)
```typescript
{
  mensal: {
    valor: number;              // Faturamento do mês
    valorFormatado: string;
    variacao: string;           // % vs mês anterior
    mesAnterior: number;
    mesAnteriorFormatado: string;
    pacientesNovosPercentual: number;  // % do faturamento de pacientes novos
  };
  anual: {
    valor: number;              // Faturamento do ano
    valorFormatado: string;
    variacao: string;           // % vs ano anterior
    anoAnterior: number;
    anoAnteriorFormatado: string;
    pacientesNovosPercentual: number;
  };
  crescimentoMensal: {
    mesPassadoAnoAnterior: number;
    mesAtual: number;
    percentual: number;
  };
  crescimentoAnual: {
    anoAnterior: number;
    anoAtual: number;
    percentual: number;
  };
  vendasHoje: {
    valor: number;
    valorFormatado: string;
    quantidade: number;
  } | null;
  faturamentoDiario: Array<{ data: string; valor: number }>;
  faturamentoMensalHistorico: Array<{ mes: string; valor: number }>;
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Mensal   │ │ Anual    │ │ Cresc.   │ │ Vendas   │       │
│  │ R$XX.XXX │ │ R$XX.XXX │ │ Mensal % │ │ Hoje     │       │
│  │ +X% vs   │ │ +X% vs   │ │          │ │ R$ XX    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Faturamento Diário  │  │ Histórico Mensal    │          │
│  │ [Line Chart]        │  │ [Bar Chart]         │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. AtendimentoPage.vue

#### Estrutura da API (`AtendimentoData`)
```typescript
{
  desempenho: Array<{
    responsavel: string;
    totalOrcamentos: number;
    valorTotalOrcado: number;
    aprovados: number;
    valorTotalAprovado: number;
    percentual: number;
  }>;
  ticketMedioPorProcedimento: Array<{
    procedimento: string;
    ticketMedio: number;
    ticketMedioFormatado: string;
    vendas: number;
    faturamentoTotal: number;
    faturamentoTotalFormatado: string;
  }>;
  pareto8020: Array<{
    procedimento: string;
    ticketMedio: number;
    faturamentoTotal: number;
    percentualAcumulado: string;
  }>;
  totalFaturamento: number;
  totalFaturamentoFormatado: string;
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Total Faturamento: R$ XXX.XXX                         │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Desempenho por Responsável                             │ │
│  │ [Table: Responsável | Orçamentos | Aprovados | %]      │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Ticket por Proced.  │  │ Pareto 80/20        │          │
│  │ [Table]             │  │ [Bar Chart + Line]  │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. ComercialPage.vue

#### Estrutura da API (`ComercialData`)
```typescript
{
  conversaoVendaPorOrigem: Array<{
    origem: string;
    negocios: number;
    valor: number;
    valorFormatado: string;
    vendas: number;
    faturado: number;
    faturadoFormatado: string;
    taxaConversao: string;
  }>;
  procedimentosPorCentro: {
    clinicaSpa: Array<{ nome: string; quantidade: number; valor: number }>;
    belaLaser: Array<{ nome: string; quantidade: number; valor: number }>;
    convenios: Array<{ nome: string; quantidade: number; valor: number }>;
  };
  procedimentosPacienteNovo: {
    labels: string[];
    vendas: number[];
    faturamento: number[];
  };
  metas: {
    spa: { atual: number; meta: number };
    convenios: { atual: number; meta: number };
    belaLaser: { atual: number; meta: number };
  };
  profissionais: Array<{ nome: string; vendas: number; valor: number }>;
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Meta Spa     │ │ Meta Conv.   │ │ Meta Bela    │        │
│  │ [Progress]   │ │ [Progress]   │ │ [Progress]   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Conversão de Vendas por Origem                         │ │
│  │ [Table: Origem | Negócios | Vendas | Faturado | Taxa]  │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Proced. Pac. Novo   │  │ Profissionais       │          │
│  │ [Bar Chart]         │  │ [Table]             │          │
│  └─────────────────────┘  └─────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │
│  │ Spa       │ │ BelaLaser │ │ Convênios │                 │
│  │ [Table]   │ │ [Table]   │ │ [Table]   │                 │
│  └───────────┘ └───────────┘ └───────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. PacientesPage.vue

#### Estrutura da API (`PacientesData`)
```typescript
{
  faturamentoPaciente: Array<{
    cliente: string;
    clienteId: string | number;
    investimento: number;
    quantidadeVendas: number;
  }>;
  potenciaisMais4Meses: Array<{
    cliente: string;
    clienteId: string | number;
    diasSemVir: number;
    investimento: number;
  }>;
  potenciaisMenos4Meses: Array<{
    cliente: string;
    clienteId: string | number;
    diasSemVir: number;
    investimento: number;
  }>;
  totalClientes: number;
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Total de Clientes: XXX                                 │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Top Faturamento por Paciente                           │ │
│  │ [Table: Cliente | Investimento | Qtd Vendas]           │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Potenciais +4 meses │  │ Potenciais -4 meses │          │
│  │ [Table]             │  │ [Table]             │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. MetasPage.vue

#### Estrutura da API (`MetasData`)
```typescript
{
  metaSpa: MetaEstabelecimento;
  metaConvenios: MetaEstabelecimento;
  metaBelaLaser: MetaEstabelecimento;
  metaNutrologia: MetaEstabelecimento;
  progressoGeral: {
    faturamentoTotal: number;
    faturamentoTotalFormatado: string;
    diasPassados: number;
    diasRestantes: number;
    totalDias: number;
    expectativaPct: number;
  };
}

// Onde MetaEstabelecimento é:
{
  nome: string;
  faturamentoAtual: number;
  faturamentoAtualFormatado: string;
  meta1: MetaInfo;
  meta2: MetaInfo;
  meta3: MetaInfo;
}

// E MetaInfo é:
{
  expectativa: number;      // % esperado no dia
  realidade: number;        // % atual
  diaria: number;           // meta diária para atingir
  metaValor: number;
  metaValorFormatado: string;
  faturamentoAtual: number;
  faturamentoAtualFormatado: string;
  diasRestantes: number;
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Progresso Geral                                        │ │
│  │ Faturamento: R$ XXX | Dias: XX/XX | Expectativa: XX%   │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ META SPA            │  │ META CONVÊNIOS      │          │
│  │ Fat: R$ XXX         │  │ Fat: R$ XXX         │          │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │          │
│  │ │ Meta 1: XX%     │ │  │ │ Meta 1: XX%     │ │          │
│  │ │ Meta 2: XX%     │ │  │ │ Meta 2: XX%     │ │          │
│  │ │ Meta 3: XX%     │ │  │ │ Meta 3: XX%     │ │          │
│  │ └─────────────────┘ │  │ └─────────────────┘ │          │
│  └─────────────────────┘  └─────────────────────┘          │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ META BELALASER      │  │ META NUTROLOGIA     │          │
│  │ (same structure)    │  │ (same structure)    │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. MarketingPage.vue

#### Estrutura da API (`MarketingData`)
```typescript
{
  horarioChegada: Array<{ hora: string; leads: number }>;
  origemLead: {
    taxaConversaoPorOrigem: Array<{
      origem: string;
      leads: number;
      emAtendimento: number;
      desqualificados: number;
      retencaoFutura: number;
      agendou: number;
      taxaConversao: string;
    }>;
    totalLeads: {
      total: number;
      semPreenchimento: number;
      iniciativaInterna: number;
      outro: number;
    };
  };
  leadsEmAtendimento: { total: number };
  leadsDesqualificados: { total: number };
  conversionFunnel?: FunnelStage[];
  byUtmSource: Array<{ source, total, converted, disqualified, inProgress, campaigns }>;
  byUtmMedium: Array<{ medium, total, converted, disqualified, inProgress }>;
  byUtmCampaign: Array<{ campaign, total, converted, disqualified, inProgress, sources }>;
  bySource: Array<{ id, name, total, converted, disqualified, inProgress, value }>;
  statusDistribution: Array<{ id, name, count, semantic, avgDaysInStatus }>;
  conversionRate: string;
  heatmap?: Array<{ dayOfWeek, hour, count }>;
  metrics?: { avgConversionDays, avgInProgressDays, totalConverted, totalDisqualified };
}
```

#### Layout Proposto
```
┌─────────────────────────────────────────────────────────────┐
│  [Tab Navigation]                                           │
├─────────────────────────────────────────────────────────────┤
│  [Filter Bar]                              [Revalidating]   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Total    │ │ Em Atend.│ │ Desqual. │ │ Taxa     │       │
│  │ Leads    │ │          │ │          │ │ Conversão│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Horário Chegada     │  │ Taxa Conv. Origem   │          │
│  │ [Bar Chart]         │  │ [Table]             │          │
│  └─────────────────────┘  └─────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Análise UTM                                            │ │
│  │ [Tabs: Source | Medium | Campaign]                     │ │
│  │ [Table based on selected tab]                          │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Distribuição Status │  │ Funil Conversão     │          │
│  │ [Pie/Bar Chart]     │  │ [Funnel Chart]      │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Reutilizáveis

### Existentes (verificar compatibilidade)
- `KPICard.vue` - para métricas principais
- `BarChartCard.vue` - gráficos de barras
- `LineChartCard.vue` - gráficos de linha
- `AreaChartCard.vue` - gráficos de área
- `PieChartCard.vue` - gráficos de pizza
- `GaugeChart.vue` - medidores de progresso
- `DataTable.vue` - tabelas de dados

### Potencialmente Necessários
- `ProgressBar.vue` - barras de progresso para metas
- `MetaEstabelecimentoCard.vue` - card complexo para metas
- `FunnelChart.vue` - funil de conversão (pode usar BarChart horizontal)
- `HeatmapChart.vue` - mapa de calor (pode ser simplificado)

---

## Considerações de Implementação

### Tratamento de Dados Ausentes
- Sempre usar optional chaining (`?.`)
- Sempre fornecer valores default (`|| 0`, `|| []`)
- Mostrar skeleton enquanto carrega
- Mostrar mensagem quando não há dados

### Formatação
- Usar `formatCurrency()` de `@/utils/format` para valores monetários
- Usar `toLocaleString('pt-BR')` para números
- Usar `toFixed(1)` para percentuais

### Responsividade
- Grid cols: 1 mobile, 2 tablet, 4 desktop para KPIs
- Grid cols: 1 mobile, 2 desktop para seções lado a lado
- Tabelas com scroll horizontal em mobile
