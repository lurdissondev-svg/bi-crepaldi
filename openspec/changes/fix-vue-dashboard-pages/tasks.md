# Tasks: Corrigir páginas do Dashboard após migração para Vue

## Task List

### Fase 1: Páginas Simples (dados mais diretos)

- [x] **T1: Corrigir FaturamentoPage.vue**
  - Atualizado para usar estrutura correta: `mensal`, `anual`, `crescimentoMensal`, `crescimentoAnual`
  - Exibe `vendasHoje` quando disponível
  - Gráfico de linha com `faturamentoDiario`
  - Gráfico de barras com `faturamentoMensalHistorico`
  - KPIs: Faturamento Mensal, Faturamento Anual, Crescimento Mensal, Crescimento Anual/Vendas Hoje
  - Mostra percentual de pacientes novos
  - **Validação**: ✅ Compilação sem erros

- [x] **T2: Corrigir AtendimentoPage.vue**
  - Atualizado para usar estrutura correta: `desempenho`, `ticketMedioPorProcedimento`, `pareto8020`
  - Tabela de desempenho por responsável (orçamentos, aprovados, percentual)
  - Tabela de ticket médio por procedimento
  - Gráfico Pareto 80/20 dos procedimentos
  - KPIs: Total Faturamento, Total Orçamentos, Aprovados, Taxa de Aprovação
  - **Validação**: ✅ Compilação sem erros

### Fase 2: Páginas Médias

- [x] **T3: Corrigir ComercialPage.vue**
  - Atualizado para usar estrutura correta: `conversaoVendaPorOrigem`, `procedimentosPorCentro`, `procedimentosPacienteNovo`, `metas`, `profissionais`
  - Cards de metas por estabelecimento (Spa, Convênios, Bela Laser) com barras de progresso
  - Tabela de conversão de vendas por origem
  - Gráfico de procedimentos paciente novo
  - Tabela de profissionais
  - Tabelas de procedimentos por centro de custo (Spa, BelaLaser, Convênios)
  - **Validação**: ✅ Compilação sem erros

- [x] **T4: Corrigir PacientesPage.vue**
  - Atualizado para usar estrutura correta: `faturamentoPaciente`, `potenciaisMais4Meses`, `potenciaisMenos4Meses`, `totalClientes`
  - KPIs: Total Clientes, Total Investido, Potenciais (-4 meses), Potenciais (+4 meses)
  - Tabela de top faturamento por paciente
  - Tabelas de pacientes potenciais (mais e menos de 4 meses)
  - **Validação**: ✅ Compilação sem erros

### Fase 3: Páginas Complexas

- [x] **T5: Corrigir MetasPage.vue**
  - Atualizado para usar estrutura correta: `metaSpa`, `metaConvenios`, `metaBelaLaser`, `metaNutrologia`, `progressoGeral`
  - Card de progresso geral (faturamento total, dias passados, dias restantes, expectativa)
  - 4 cards de estabelecimento com 3 metas cada
  - Cada meta mostra: valor, realidade %, meta diária, dias restantes
  - Barras de progresso coloridas por status (verde/amarelo/vermelho)
  - **Validação**: ✅ Compilação sem erros

- [x] **T6: Corrigir MarketingPage.vue**
  - Atualizado para usar estrutura correta: `horarioChegada`, `origemLead`, `leadsEmAtendimento`, `leadsDesqualificados`, `byUtmSource`, `byUtmMedium`, `byUtmCampaign`, `bySource`, `statusDistribution`, `conversionRate`, `metrics`, `conversionFunnel`
  - KPIs: Total Leads, Em Atendimento, Desqualificados, Taxa Conversão
  - Métricas extras: Tempo médio conversão, tempo em progresso, convertidos, desqualificados
  - Gráfico de horário de chegada de leads
  - Gráfico de leads por origem (top 10)
  - Tabela de taxa de conversão por origem
  - Seção de análise UTM com tabs (Source, Medium, Campaign)
  - Gráfico de distribuição por status
  - Funil de conversão
  - Tabela detalhada de status
  - **Fix adicional**: Null check em `status.count` e `status.avgDaysInStatus` na tabela de status
  - **Validação**: ✅ Compilação sem erros

### Fase 4: Componentes de Suporte (se necessário)

- [x] **T7: Criar/Ajustar componentes de charts**
  - Componentes existentes já suportam os dados necessários
  - Não foi necessário criar novos componentes
  - **Validação**: ✅ Todos os charts renderizam

### Fase 5: Validação Final

- [x] **T8: Testes de integração**
  - Frontend compila sem erros
  - HMR funciona corretamente
  - Backend está rodando e sincronizando dados
  - **Validação**: ✅ Sistema funcional

- [ ] **T9: Build e Deploy**
  - Executar `npm run build` sem erros
  - Verificar tipos TypeScript
  - Commit e push das alterações
  - **Validação**: Pendente usuário decidir

## Order of Execution - COMPLETO
1. ✅ T1 (Faturamento)
2. ✅ T2 (Atendimento)
3. ✅ T3 (Comercial)
4. ✅ T4 (Pacientes)
5. ✅ T5 (Metas)
6. ✅ T6 (Marketing)
7. ✅ T7 (Componentes)
8. ✅ T8 (Testes)
9. ⏳ T9 (Build) - Pendente

## Resumo das Alterações

| Página | Status | Arquivos Alterados |
|--------|--------|-------------------|
| FaturamentoPage.vue | ✅ Corrigido | 1 arquivo |
| AtendimentoPage.vue | ✅ Corrigido | 1 arquivo |
| ComercialPage.vue | ✅ Corrigido | 1 arquivo |
| PacientesPage.vue | ✅ Corrigido | 1 arquivo |
| MetasPage.vue | ✅ Corrigido | 1 arquivo |
| MarketingPage.vue | ✅ Corrigido | 1 arquivo |
| **Total** | **6 páginas** | |
