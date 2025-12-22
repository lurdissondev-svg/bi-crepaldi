# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2.5.0] - 2025-12-21

### Adicionado

#### Dashboard 8Ps - Metodologia Conrado Adolpho
Nova implementação completa dos indicadores de marketing baseados na metodologia 8Ps do Marketing Digital (Imersão 8Ps - Conrado Adolpho), com 17 indicadores da geração de caixa organizados por departamento:

**Departamento Financeiro (FIN)**
- Faturamento total e lucro
- Investimento em marketing
- ROAS (Return on Ad Spend)
- Margem de lucro

**Departamento Marketing (MKT)**
- Público alcançado e cliques
- Leads e leads qualificados
- TX1 (Taxa de conversão página) = Leads / Cliques
- CTR (Click-Through Rate)
- CPL (Custo por Lead)
- Taxa de qualificação de leads

**Departamento Comercial 1 - Aquisição (COM1)**
- Leads, agendamentos, atendimentos e vendas
- Faturamento de novos clientes
- Ticket médio
- CAC (Custo de Aquisição de Cliente)
- TX2 (Taxa de conversão vendas) = Vendas / Leads
- Taxa de comparecimento e fechamento

**Departamento Comercial 2 - Recorrência (COM2)**
- Clientes ativos e recorrentes
- Taxa de recompra
- LTV (Lifetime Value)
- Relação LTV:CAC
- Churn rate
- Ticket médio recorrente

#### Novas Rotas da API
```
GET /api/dashboard/8ps              - Indicadores principais 8Ps
GET /api/dashboard/8ps/avancado     - Métricas avançadas
GET /api/dashboard/8ps/campanhas    - Performance por campanha
GET /api/dashboard/8ps/gargalos     - Identificação de gargalos
GET /api/dashboard/8ps/publicos     - Segmentação dos 9 públicos
GET /api/dashboard/8ps/alertas      - Alertas automáticos
GET /api/dashboard/8ps/saude        - Status de saúde por departamento
GET /api/dashboard/8ps/metas        - Metas configuráveis
```

#### Painel de Saúde do Marketing
- Indicador visual de saúde geral (verde/amarelo/vermelho)
- Saúde por departamento (FIN, MKT, COM1, COM2)
- Alertas prioritários com ações recomendadas
- Monitoramento automático de métricas críticas

#### CAC por Canal de Aquisição
- Custo de aquisição segmentado por canal de marketing
- Gráfico comparativo entre canais
- Tabela detalhada com investimento, novos pacientes e CAC

#### Funil de Conversão Comparativo
- Comparação período atual vs período anterior
- Delta percentual para cada métrica
- Visualização de barras sobrepostas
- Métricas: Total leads, convertidos, taxa de conversão

#### Performance por Fonte de Tráfego
- ROAS por fonte
- CPL por fonte
- Taxa de conversão por fonte
- Tabela detalhada com todas as métricas

#### Análise Cruzada Origem x Campanha
- Cruzamento entre origem do lead e campanha Bitrix
- Métricas: em atendimento, agendados, convertidos, desqualificados
- Taxas de agendamento e conversão

### Melhorado

#### Página de Marketing (MarketingPage.vue)
- Redesign completo com KPIStrip para métricas primárias
- Integração com indicadores 8Ps
- Novos gráficos e tabelas de análise
- Experiência de usuário aprimorada

#### Sistema de KPIs
- Novo componente KPIStrip para exibição de métricas
- Suporte a múltiplos formatos (moeda, porcentagem, multiplicador, dias)
- Indicadores visuais de status (success, warning, danger)

### Corrigido

- **Profissionais com mais vendas**: Correção no cálculo e ordenação
- **Pacientes novos**: Correção no cálculo de novos pacientes do período
- **Motivos de desqualificação**: Correção na exibição e filtragem
- **Plano Personalizado**: Filtro para exclusão de planos específicos

---

## [2.4.0] - 2025-12-20

### Adicionado

- Indicadores KPI abrangentes para gestão de clínicas
- Sincronização de procedimentos diários com suporte a CONSULTA e AVALIACAO
- Sistema de dias úteis configurável para cálculo de metas
- Sistema de autenticação de usuários e gerenciamento de roles

### Melhorado

- Migração do frontend de React para Vue 3
- Otimização de queries de banco de dados
- Cache de procedimentos e profissionais

---

## [2.3.0] - 2025-12-15

### Adicionado

- Análise de clientes inativos
- Risco de churn com alertas
- Métricas de tempo de conversão lead-to-sale
- Atribuição de campanhas

### Melhorado

- Performance geral do dashboard
- Filtros de data mais intuitivos

---

## [2.2.0] - 2025-12-10

### Adicionado

- Integração com Meta Ads API (Facebook/Instagram)
- Métricas de campanhas (impressões, cliques, conversões)
- Custo por lead e ROI de campanhas
- Configuração de credenciais Meta Ads no sistema

---

## [2.1.0] - 2025-12-05

### Adicionado

- Dashboard de Pacientes com análise de potencial
- Segmentação RFM (Recency, Frequency, Monetary)
- Top clientes por LTV
- Análise 80/20 de faturamento

---

## [2.0.0] - 2025-12-01

### Adicionado

- Migração completa para Vue 3 + TypeScript
- Sistema de stores com Pinia
- Componentes de gráficos reutilizáveis (Recharts → Vue Chart.js)
- Tema escuro nativo com variáveis CSS
- Sistema de cache no frontend

### Alterado

- Arquitetura frontend completamente refatorada
- Build system atualizado para Vite 5

---

## [1.0.0] - 2025-11-15

### Adicionado

- Dashboard inicial com 8 páginas:
  - Resumo, Faturamento, Marketing, Comercial
  - Atendimento, Administrativo Financeiro, Metas, Pacientes
- Integração Bitrix24 CRM
- Integração Belle Software
- Sistema de cache Redis
- Filtros por data e centro de custo
- Gráficos interativos com Recharts
