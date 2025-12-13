# Spec: API Integration and Data Accuracy

## Overview
Correção e aprimoramento das integrações com Bitrix24 e Belle Software para garantir dados 100% assertivos no BI.

---

## MODIFIED Requirements

### Requirement: Marketing Dashboard Data
O dashboard de marketing MUST exibir apenas dados reais provenientes das APIs, sem valores mockados ou placeholders.

#### Scenario: Load Marketing Page with Real Data
**Given** o usuário acessa a página de Marketing
**When** a página carrega
**Then** o gráfico de "Horário de chegada dos leads" exibe dados reais do Bitrix24
**And** a tabela de "Taxa de Conversão por Origem" mostra dados calculados da API
**And** o card "Total de Leads" exibe distribuição real por categoria
**And** nenhum dado mockado é utilizado

#### Scenario: Handle API Error Gracefully
**Given** o usuário acessa a página de Marketing
**When** a API do Bitrix24 retorna erro
**Then** uma mensagem de erro amigável é exibida
**And** o usuário pode tentar novamente
**And** o erro é registrado no log

---

### Requirement: Lead Analytics Calculation
Os cálculos de analytics de leads MUST refletir com precisão os dados do Bitrix24.

#### Scenario: Calculate Hourly Lead Distribution
**Given** existem leads no Bitrix24 no período selecionado
**When** a análise de horário é executada
**Then** os leads são agrupados por hora de criação (DATE_CREATE)
**And** cada hora exibe a contagem correta de leads
**And** horas sem leads exibem valor 0

#### Scenario: Calculate Conversion Rate by Source
**Given** existem leads com diferentes SOURCE_ID
**When** a taxa de conversão é calculada
**Then** leads com STATUS_SEMANTIC_ID = 'S' são contados como convertidos
**And** leads com STATUS_SEMANTIC_ID = 'F' são contados como desqualificados
**And** a taxa é calculada como (convertidos / total) * 100

#### Scenario: Process UTM Parameters
**Given** leads possuem parâmetros UTM (UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN)
**When** os dados são processados
**Then** leads sem UTM são agrupados como "Sem UTM"
**And** leads com UTM são agrupados por fonte
**And** campanhas são listadas dentro de cada fonte

---

### Requirement: Patient Calculation Accuracy
Os cálculos de pacientes novos vs recorrentes MUST ser baseados em dados reais.

#### Scenario: Identify New Patients
**Given** existe um lead que foi convertido em venda
**When** o paciente é classificado
**Then** é verificado se existe histórico anterior no Belle Software
**And** se não existe histórico, é classificado como "novo"
**And** se existe histórico, é classificado como "recorrente"

#### Scenario: Calculate Patient Metrics
**Given** existem vendas no período selecionado
**When** as métricas de pacientes são calculadas
**Then** `pacientesNovosPercentual` é calculado como (novos / total) * 100
**And** `ticketMedioPacienteNovo` é a média de valor das vendas de pacientes novos
**And** nenhum valor placeholder é utilizado

---

### Requirement: Belle Software Data Validation
Os dados provenientes da API Belle MUST ser validados antes do uso.

#### Scenario: Validate Revenue Data
**Given** a API Belle retorna dados de contas a receber
**When** os dados são processados
**Then** apenas movimentos com `confirmado = 'S'` são contabilizados
**And** valores nulos ou inválidos são tratados como 0
**And** a data é formatada corretamente (dd/MM/yyyy)

#### Scenario: Handle Missing Data
**Given** a API Belle retorna dados incompletos
**When** os dados são processados
**Then** campos ausentes recebem valores default apropriados
**And** um warning é registrado no log
**And** o processamento continua sem falhar

---

## ADDED Requirements

### Requirement: Data Validation Service
O sistema MUST validar todos os dados recebidos das APIs externas.

#### Scenario: Validate Bitrix Lead Data
**Given** a API Bitrix retorna um lead
**When** o lead é validado
**Then** campos obrigatórios são verificados (ID, DATE_CREATE, STATUS_ID)
**And** campos UTM são sanitizados
**And** leads inválidos são excluídos do processamento com log

#### Scenario: Validate Belle Sale Data
**Given** a API Belle retorna uma venda
**When** a venda é validada
**Then** campos obrigatórios são verificados (cod_cliente, valor_venda)
**And** datas são convertidas para formato padrão
**And** valores monetários são convertidos para número

### Requirement: Error Logging
Todos os erros de integração MUST ser logados de forma estruturada.

#### Scenario: Log API Error
**Given** uma chamada à API externa falha
**When** o erro é capturado
**Then** o log inclui: timestamp, endpoint, status code, mensagem
**And** o log inclui parâmetros da requisição (sem dados sensíveis)
**And** o erro é categorizado (network, auth, validation, unknown)

---

## Technical Notes

### Bitrix24 Status Semantics
- `P` (Process) = Em andamento
- `S` (Success) = Convertido/Sucesso
- `F` (Failure) = Desqualificado/Falha

### Belle API Date Format
- Input/Output: `dd/MM/yyyy`
- Internal processing: ISO 8601

### Cache Strategy
- Dashboard data: 5 minutes TTL
- Filter options: 1 hour TTL
- Invalidate on filter change
