# Spec: Data Accuracy and Validation

## Overview
Garantir que todos os dados exibidos no BI sejam 100% precisos, validados e rastreáveis.

---

## ADDED Requirements

### Requirement: Data Validation Layer
O sistema MUST validar todos os dados recebidos de APIs externas.

#### Scenario: Validate Bitrix Lead Response
**Given** a API Bitrix retorna uma lista de leads
**When** os dados são processados
**Then** cada lead é validado quanto a campos obrigatórios
**And** leads com ID ou DATE_CREATE inválidos são excluídos
**And** um log de warning é gerado para cada lead excluído
**And** o processamento continua com leads válidos

#### Scenario: Validate Belle Sale Response
**Given** a API Belle retorna uma lista de vendas
**When** os dados são processados
**Then** vendas com valor_venda inválido (null, NaN) recebem valor 0
**And** datas são normalizadas para ISO 8601
**And** campos monetários são convertidos para número
**And** registros totalmente inválidos são excluídos com log

#### Scenario: Handle Empty Responses
**Given** uma API retorna array vazio ou null
**When** os dados são processados
**Then** o sistema não falha
**And** métricas retornam valores zerados
**And** a UI exibe "Nenhum dado encontrado"

### Requirement: Lead-Sale Correlation
O sistema MUST correlacionar leads do Bitrix com vendas do Belle.

#### Scenario: Match by Phone Number
**Given** um lead tem número de telefone
**And** existe uma venda no Belle com mesmo telefone
**When** a correlação é executada
**Then** o lead é marcado como "convertido com venda"
**And** o valor da venda é associado ao lead
**And** o campo `revenue` do lead é preenchido

#### Scenario: Match by Email
**Given** um lead tem email mas não tem telefone
**And** existe uma venda no Belle com mesmo email
**When** a correlação é executada
**Then** o lead é correlacionado por email
**And** o match_type é registrado como "email"
**And** uma confiança menor é atribuída (80%)

#### Scenario: No Match Found
**Given** um lead não tem correspondência no Belle
**When** a correlação é executada
**Then** o lead é marcado como "convertido sem venda identificada"
**And** o campo `sale` permanece null
**And** o lead ainda conta como conversão no Bitrix

### Requirement: Calculation Accuracy
Todos os cálculos MUST ser baseados em fórmulas documentadas.

#### Scenario: Calculate Conversion Rate
**Given** existem N leads no período
**And** C deles têm status de conversão (CONVERTED)
**When** a taxa de conversão é calculada
**Then** conversionRate = (C / N) * 100
**And** o resultado tem 2 casas decimais
**And** se N = 0, retorna 0 (não NaN)

#### Scenario: Calculate New vs Recurring Patients
**Given** existem vendas no período
**When** pacientes são classificados
**Then** para cada venda, verifica histórico no Belle:
  - Se primeira venda do cliente: "novo"
  - Se já teve venda anterior: "recorrente"
**And** percentuais são calculados sobre total de vendas
**And** nenhum placeholder (30%, 37.07%) é usado

#### Scenario: Calculate Average Ticket
**Given** existem N vendas com valor total V
**When** ticket médio é calculado
**Then** ticketMedio = V / N
**And** se N = 0, retorna 0
**And** o valor é formatado como moeda BRL

### Requirement: Error Handling
Erros MUST ser tratados de forma que não corrompam dados.

#### Scenario: API Timeout
**Given** uma chamada à API demora mais de 60 segundos
**When** o timeout ocorre
**Then** um erro é logado com detalhes da requisição
**And** o endpoint retorna erro 504 ou 503
**And** a UI exibe mensagem "Servidor demorou para responder"
**And** um botão "Tentar novamente" é exibido

#### Scenario: Partial API Failure
**Given** uma de múltiplas chamadas paralelas falha
**When** o erro é capturado
**Then** as chamadas bem-sucedidas são processadas
**And** um warning indica dados parciais
**And** a UI mostra quais dados estão indisponíveis

#### Scenario: Data Inconsistency Detected
**Given** um cálculo resulta em valor impossível (ex: taxa > 100%)
**When** a validação detecta
**Then** o valor é ajustado para o máximo válido
**And** um log de erro é registrado
**And** um alerta é exibido para revisão

### Requirement: Health Check Enhancement
O health check MUST verificar todas as integrações.

#### Scenario: Full Health Check
**Given** o endpoint GET /api/health é chamado
**When** o check é executado
**Then** retorna status de cada integração:
  - bitrix: { status, latency, lastSuccess }
  - belle: { status, latency, lastSuccess }
  - meta: { status, configured, lastSync }
**And** status geral é "healthy" se todos ok
**And** status geral é "degraded" se algum falhou

#### Scenario: Individual Integration Check
**Given** a integração Belle está falhando
**When** o health check é executado
**Then** belle.status = "unhealthy"
**And** belle.error = "Connection timeout"
**And** outras integrações continuam funcionando

---

## MODIFIED Requirements

### Requirement: Frontend Data Loading
O frontend MUST lidar corretamente com estados de carregamento.

#### Scenario: Initial Page Load
**Given** o usuário acessa uma página do dashboard
**When** os dados estão carregando
**Then** skeleton loaders são exibidos
**And** nenhum dado mockado é usado como fallback
**And** a interação com filtros é bloqueada até carregar

#### Scenario: Filter Change
**Given** os dados estão carregados
**When** o usuário altera um filtro
**Then** um indicador de loading é exibido
**And** dados anteriores permanecem visíveis (não limpar)
**And** ao completar, dados são substituídos atomicamente

#### Scenario: Refresh Data
**Given** o usuário clica em "Atualizar"
**When** novos dados são buscados
**Then** cache é invalidado
**And** dados frescos são buscados das APIs
**And** timestamp de última atualização é exibido

---

## Logging Specification

### Log Levels
| Level | Use Case |
|-------|----------|
| ERROR | Falhas de API, dados corrompidos |
| WARN | Dados ausentes, fallbacks usados |
| INFO | Requisições bem-sucedidas, métricas |
| DEBUG | Detalhes de processamento |

### Log Structure
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "ERROR",
  "service": "bitrix24",
  "action": "getLeads",
  "error": "Connection refused",
  "context": {
    "dateRange": ["2024-01-01", "2024-01-31"],
    "attempt": 1
  },
  "duration": 5023
}
```

---

## Validation Rules

### Bitrix Lead
| Field | Validation | Action on Fail |
|-------|------------|----------------|
| ID | Required, numeric | Exclude record |
| DATE_CREATE | Required, valid date | Exclude record |
| STATUS_ID | Required, string | Default to "NEW" |
| UTM_SOURCE | Optional, string | Default to null |
| OPPORTUNITY | Optional, numeric | Default to 0 |

### Belle Sale
| Field | Validation | Action on Fail |
|-------|------------|----------------|
| cod_venda | Required | Exclude record |
| valor_venda | Numeric >= 0 | Default to 0 |
| data_venda | Valid date | Exclude record |
| cod_cliente | Numeric | Log warning |
| confirmado | 'S' or 'N' | Default to 'N' |

---

## Technical Notes

### Phone Number Normalization
```javascript
// Remove all non-numeric characters
// Keep only last 11 digits (DDD + number)
normalizePhone(phone) {
  return phone.replace(/\D/g, '').slice(-11);
}
```

### Date Format Handling
```javascript
// Belle uses dd/MM/yyyy
// API uses yyyy-MM-dd
// Internal uses ISO 8601
```

### Decimal Precision
- Monetary values: 2 decimal places
- Percentages: 2 decimal places
- Quantities: integers only
