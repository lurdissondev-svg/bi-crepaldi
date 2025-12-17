# Change: Otimizar Camada de Dados do Frontend para Respostas Instantaneas

## Why

O dashboard de BI apresenta delay perceptivel (~2-4 segundos) ao alterar filtros, mesmo com os dados ja sincronizados no PostgreSQL local. Alem disso, alguns filtros de periodo curto (ex: "Hoje") nao estao atualizando corretamente os dados exibidos. O usuario espera respostas instantaneas (<500ms) ja que o sync job roda a cada 15 minutos para popular o banco de dados local.

## What Changes

### 1. Frontend - Otimizacoes de Cache e Fetch

- **Cache Frontend Inteligente**: Implementar cache de navegacao com invalidacao baseada no sync
- **Prefetch em Background**: Carregar dados previsiveis quando o usuario navega
- **Loading Skeleton Otimizado**: Mostrar dados em cache imediatamente enquanto revalida
- **Debounce de Filtros**: Evitar multiplas requisicoes ao mudar filtros rapidamente

### 2. Backend - Garantir Consultas ao PostgreSQL

- **Verificar Endpoints Restantes**: Garantir que TODOS os endpoints usam banco (nao API)
- **Otimizar Queries**: Adicionar indices e otimizar queries lentas identificadas
- **Cache Layer Backend**: Implementar cache de 5 minutos para queries pesadas
- **Filtros de Data Exatos**: Corrigir queries que usam cache mensal para periodos curtos

### 3. Sincronizacao e Status

- **Indicador de Sync Visual**: Mostrar quando dados estao sendo atualizados
- **Timestamp de Ultima Sync**: Exibir quando os dados foram atualizados por ultimo
- **Auto-Refresh Pos-Sync**: Invalidar cache frontend apos sync completar

## Impact

- Affected specs: `frontend-data-layer` (novo)
- Affected code:
  - `frontend/src/stores/dashboard.ts` - Cache e fetch otimizado
  - `frontend/src/services/cache.ts` - Cache inteligente com sync awareness
  - `frontend/src/components/ui/SyncTimer.vue` - Indicador de sync
  - `backend/src/services/dashboard.db.service.js` - Queries otimizadas
  - `backend/src/controllers/dashboard.controller.js` - Garantir uso do banco

### Metricas de Sucesso

| Metrica | Atual | Meta |
|---------|-------|------|
| Tempo de resposta (filtro) | 2-4s | <500ms |
| Filtros com cache | ~60% | 100% |
| Dados corretos com filtro "Hoje" | Parcial | 100% |

### Paginas Impactadas

1. **MarketingPage** - Filtros de data, procedimentos por estabelecimento
2. **FaturamentoPage** - Filtros de periodo, dados diarios
3. **ComercialPage** - Origem de leads, conversao
4. **AtendimentoPage** - Performance por profissional
5. **PacientesPage** - Analytics de clientes
6. **MetasPage** - Metas por estabelecimento
7. **ResumoPage** - KPIs gerais
