# Tasks: Otimizar Camada de Dados do Frontend

## 1. Auditoria de Endpoints e Filtros

- [ ] 1.1 Mapear todos os endpoints do dashboard e verificar fonte de dados (DB vs API)
- [ ] 1.2 Identificar queries que usam cache mensal incorretamente para periodos curtos
- [ ] 1.3 Testar todos os filtros de data em cada pagina (Hoje, Ontem, 7 dias, 30 dias, Mes, Ano)
- [ ] 1.4 Documentar endpoints que ainda fazem chamadas a APIs externas

## 2. Backend - Otimizacao de Queries

- [x] 2.1 Corrigir `getProcedimentosPorEstabelecimento` para periodos curtos (usar tabela vendas diretamente)
- [x] 2.2 Verificar e corrigir `getProfissionaisFromCache` para periodos curtos
- [ ] 2.3 Adicionar indices no PostgreSQL para queries frequentes
- [ ] 2.4 Implementar query direta para filtros <= 7 dias em todas as funcoes que usam cache

## 3. Backend - Garantir Uso do PostgreSQL

- [ ] 3.1 Auditar `getComercial` - verificar se usa banco para leads
- [ ] 3.2 Auditar `getAtendimento` - verificar fonte de dados de faturamento
- [ ] 3.3 Auditar `getMetas` - verificar se todas as categorias vem do banco
- [ ] 3.4 Remover fallbacks lentos para APIs externas onde possivel

## 4. Frontend - Cache Inteligente

- [x] 4.1 Adicionar `syncAwareCache` que invalida baseado no timestamp de sync
- [x] 4.2 Implementar polling leve para verificar status do sync (a cada 30s)
- [x] 4.3 Invalidar cache do frontend quando sync completar
- [x] 4.4 Adicionar debounce de 300ms no FilterBar para evitar multiplas requisicoes

## 5. Frontend - UI/UX de Loading

- [x] 5.1 Mostrar dados em cache imediatamente (skeleton apenas se sem cache)
- [x] 5.2 Adicionar indicador visual "Dados de X minutos atras" com timestamp
- [ ] 5.3 Melhorar `RevalidatingIndicator` para ser menos intrusivo
- [ ] 5.4 Adicionar transicoes suaves ao atualizar dados

## 6. Frontend - Sync Status

- [x] 6.1 Atualizar `SyncTimer.vue` para mostrar countdown real ate proxima sync
- [ ] 6.2 Adicionar notificacao quando sync completar com sucesso
- [ ] 6.3 Mostrar status de erro se sync falhar

## 7. Testes e Validacao

- [ ] 7.1 Testar filtro "Hoje" em todas as paginas
- [ ] 7.2 Testar filtro "Ontem" em todas as paginas
- [ ] 7.3 Testar filtro "Ultimos 7 dias" em todas as paginas
- [ ] 7.4 Medir tempo de resposta antes/depois em cada endpoint
- [ ] 7.5 Validar que dados mostrados correspondem ao periodo selecionado

## 8. Documentacao

- [ ] 8.1 Documentar arquitetura de cache (frontend + backend)
- [ ] 8.2 Documentar fluxo de sincronizacao
- [ ] 8.3 Criar guia de troubleshooting para problemas de filtros
