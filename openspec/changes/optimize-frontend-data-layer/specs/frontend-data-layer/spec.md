# Frontend Data Layer Specification

## ADDED Requirements

### Requirement: Cache Sync-Aware
O sistema de cache do frontend DEVE invalidar automaticamente quando uma sincronizacao for concluida no backend.

#### Scenario: Cache invalida apos sync
- **WHEN** o backend completa uma sincronizacao com sucesso
- **THEN** o frontend detecta atraves de polling do endpoint `/api/dashboard/sync-status`
- **THEN** o cache do frontend e invalidado para os filtros atuais
- **THEN** novos dados sao buscados em background

#### Scenario: Mostrar dados em cache imediatamente
- **WHEN** o usuario muda um filtro
- **THEN** se houver dados em cache para esse filtro, exibir imediatamente
- **THEN** mostrar indicador de "revalidando" enquanto busca dados frescos
- **THEN** atualizar a tela quando dados frescos chegarem

### Requirement: Filtros de Periodo Exato
Todas as consultas de dados DEVEM respeitar exatamente o periodo selecionado pelo usuario, sem usar caches mensais para periodos curtos.

#### Scenario: Filtro "Hoje" mostra dados do dia
- **WHEN** usuario seleciona filtro "Hoje"
- **THEN** a API retorna dados apenas do dia atual
- **THEN** procedimentos por estabelecimento mostram vendas do dia
- **THEN** profissionais mostram vendas do dia
- **THEN** KPIs refletem apenas o dia atual

#### Scenario: Filtro "Ultimos 7 dias" mostra dados exatos
- **WHEN** usuario seleciona filtro "Ultimos 7 dias"
- **THEN** a API retorna dados dos ultimos 7 dias (incluindo hoje)
- **THEN** todos os graficos e tabelas refletem esse periodo
- **THEN** nao usa cache mensal agregado

### Requirement: Debounce de Filtros
O componente FilterBar DEVE implementar debounce para evitar multiplas requisicoes ao mudar filtros rapidamente.

#### Scenario: Usuario muda filtros rapidamente
- **WHEN** usuario altera filtros multiplas vezes em menos de 300ms
- **THEN** apenas uma requisicao e feita apos o debounce
- **THEN** requisicoes intermediarias sao canceladas

### Requirement: Indicador de Status de Sync
O frontend DEVE exibir claramente o status da sincronizacao e quando os dados foram atualizados por ultimo.

#### Scenario: Exibir timestamp de ultima sync
- **WHEN** usuario visualiza o dashboard
- **THEN** ve um indicador com "Atualizado ha X minutos"
- **THEN** indicador atualiza a cada minuto

#### Scenario: Sync em andamento
- **WHEN** uma sincronizacao esta em andamento no backend
- **THEN** frontend mostra indicador visual de "Sincronizando..."
- **THEN** apos conclusao, invalida cache e atualiza dados

### Requirement: Consultas ao Banco de Dados
Todos os endpoints do dashboard DEVEM buscar dados do PostgreSQL local, nao de APIs externas.

#### Scenario: Marketing usa banco para deals WON/LOST
- **WHEN** endpoint `/api/dashboard/marketing` e chamado
- **THEN** deals WON sao buscados da tabela `deals` com `stage_id LIKE '%:WON'`
- **THEN** deals LOST sao buscados da tabela `deals` com `stage_id LIKE '%:LOSE'`
- **THEN** nao faz chamadas a API Bitrix24

#### Scenario: Procedimentos para periodos curtos
- **WHEN** periodo selecionado e menor que 28 dias
- **THEN** consultar tabela `vendas` diretamente com datas exatas
- **THEN** nao usar tabela `procedimentos_cache` (agregada por mes)

### Requirement: Performance de Resposta
O dashboard DEVE responder a mudancas de filtro em menos de 500ms quando dados estao em cache.

#### Scenario: Resposta rapida com cache
- **WHEN** usuario muda filtro e dados estao em cache
- **THEN** dados aparecem na tela em menos de 100ms
- **THEN** indicador de revalidacao aparece
- **THEN** dados frescos chegam em ate 2 segundos

#### Scenario: Resposta sem cache
- **WHEN** usuario muda filtro e nao ha cache
- **THEN** skeleton/loading aparece
- **THEN** dados aparecem em ate 2 segundos (consulta ao PostgreSQL)
