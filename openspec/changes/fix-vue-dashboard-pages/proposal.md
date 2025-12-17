# Proposal: Corrigir páginas do Dashboard após migração para Vue

## Change ID
`fix-vue-dashboard-pages`

## Status
`proposed`

## Summary
Corrigir todas as páginas do dashboard Vue que foram migradas de React com dados incorretos ou faltando. Durante a migração React → Vue, as páginas foram criadas com estruturas de dados simplificadas que não correspondem à estrutura real retornada pela API do backend.

## Problem Statement

### Contexto
O frontend foi migrado de React para Vue 3 + Composition API. Durante essa migração, as páginas foram recriadas com base em suposições sobre a estrutura de dados, mas não foram alinhadas corretamente com os tipos TypeScript existentes (`src/types/index.ts`) nem com os endpoints da API (`src/services/api.ts`).

### Problemas Identificados

#### 1. **FaturamentoPage.vue**
- **Esperado pela API**: `FaturamentoData` com `mensal`, `anual`, `crescimentoMensal`, `crescimentoAnual`, `vendasHoje`, `faturamentoDiario`, `faturamentoMensalHistorico`
- **Implementado**: Busca campos inexistentes como `total`, `ticketMedio`, `totalVendas`, `diasPeriodo`, `historico`
- **Impacto**: Todos os KPIs mostram 0, gráfico não renderiza

#### 2. **MarketingPage.vue**
- **Esperado pela API**: `MarketingData` com `horarioChegada`, `origemLead`, `leadsEmAtendimento`, `leadsDesqualificados`, `conversionFunnel`, `byUtmSource`, `byUtmMedium`, `byUtmCampaign`, `bySource`, `statusDistribution`, `conversionRate`, `heatmap`, `metrics`
- **Implementado**: Busca campos inexistentes como `totalLeads`, `taxaConversao`, `custoLead`, `roi`, `porOrigem`
- **Impacto**: KPIs incorretos, gráficos não renderizam

#### 3. **ComercialPage.vue**
- **Esperado pela API**: `ComercialData` com `conversaoVendaPorOrigem`, `procedimentosPorCentro`, `procedimentosPacienteNovo`, `metas`, `profissionais`
- **Implementado**: Busca campos inexistentes como `totalVendas`, `quantidadeVendas`, `metaAtingida`, `crescimento`, `vendasPorOrigem`
- **Impacto**: Todos os dados estão incorretos

#### 4. **AtendimentoPage.vue**
- **Esperado pela API**: `AtendimentoData` com `desempenho`, `ticketMedioPorProcedimento`, `pareto8020`, `totalFaturamento`
- **Implementado**: Busca campos inexistentes como `totalAtendimentos`, `tempoMedio`, `satisfacao`, `profissionaisAtivos`, `porProfissional`
- **Impacto**: Todos os KPIs mostram 0, gráfico não renderiza

#### 5. **MetasPage.vue**
- **Esperado pela API**: `MetasData` com `metaSpa`, `metaConvenios`, `metaBelaLaser`, `metaNutrologia`, `progressoGeral`
- **Implementado**: Busca campos inexistentes como `meta`, `realizado` (valores simples)
- **Impacto**: Estrutura completamente diferente, precisa mostrar 4 estabelecimentos com 3 metas cada

#### 6. **PacientesPage.vue**
- **Esperado pela API**: `PacientesData` com `faturamentoPaciente`, `potenciaisMais4Meses`, `potenciaisMenos4Meses`, `totalClientes`
- **Implementado**: Busca campos inexistentes como `total`, `novos`, `inativos`, `ltvMedio`, `lista`
- **Impacto**: Todos os dados estão incorretos

## Proposed Solution

### Abordagem
Reescrever cada página Vue para:
1. Usar os campos corretos conforme definido em `src/types/index.ts`
2. Implementar visualizações adequadas para cada tipo de dado
3. Adicionar componentes de charts faltantes quando necessário
4. Manter a consistência visual com o design existente

### Escopo
- 6 páginas a corrigir: Faturamento, Marketing, Comercial, Atendimento, Metas, Pacientes
- ResumoPage.vue já está correta (usa estrutura certa)
- MetaAdsConfigPage.vue e ComoFuncionaPage.vue não precisam de correção

## Impact Analysis

### Arquivos Afetados
- `frontend/src/pages/FaturamentoPage.vue` - reescrita completa
- `frontend/src/pages/MarketingPage.vue` - reescrita completa
- `frontend/src/pages/ComercialPage.vue` - reescrita completa
- `frontend/src/pages/AtendimentoPage.vue` - reescrita completa
- `frontend/src/pages/MetasPage.vue` - reescrita completa
- `frontend/src/pages/PacientesPage.vue` - reescrita completa

### Componentes Potencialmente Novos
- `ConversionFunnel.vue` - para Marketing (funil de conversão)
- `HeatmapChart.vue` - para Marketing (horários de chegada)
- `StatusDistribution.vue` - para Marketing (distribuição de status)
- `UTMAnalytics.vue` - para Marketing (análise UTM)
- `MetaCard.vue` - para Metas (card com 3 metas por estabelecimento)

### Risco
- **Baixo**: Apenas frontend, sem alterações no backend
- **Reversível**: Git permite rollback fácil

## Success Criteria
1. Todas as 6 páginas exibem dados corretos da API
2. Gráficos renderizam com dados reais
3. KPIs mostram valores corretos
4. Sem erros de console relacionados a campos undefined
5. Build passa sem erros TypeScript

## Dependencies
- Backend deve estar rodando para testar
- Dados devem existir no banco para visualização

## Timeline Estimate
- Páginas simples (Faturamento, Atendimento): ~30 min cada
- Páginas complexas (Marketing, Metas): ~1h cada
- Páginas médias (Comercial, Pacientes): ~45 min cada
- **Total estimado**: ~4-5 horas de implementação
