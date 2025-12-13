# Spec: Meta Ads Configuration Module

## Overview
Novo módulo para configuração e preparação da integração com Meta Ads (Facebook/Instagram) via Graph API, permitindo futura análise de ROI de campanhas.

---

## ADDED Requirements

### Requirement: Meta Ads Configuration Page
O sistema MUST ter uma página dedicada para configuração das credenciais do Meta Ads.

#### Scenario: Access Configuration Page
**Given** o usuário está autenticado no BI
**When** acessa o menu "Configurações > Meta Ads"
**Then** a página de configuração é exibida
**And** mostra o status atual da integração (Configurado/Pendente/Erro)
**And** exibe formulário de configuração

#### Scenario: Configure Meta Ads Credentials
**Given** o usuário está na página de configuração Meta Ads
**When** preenche os campos: App ID, App Secret, Access Token, Ad Account ID
**And** clica em "Salvar Configuração"
**Then** as credenciais são validadas
**And** se válidas, são salvas de forma criptografada
**And** uma mensagem de sucesso é exibida
**And** o status muda para "Configurado"

#### Scenario: Invalid Credentials
**Given** o usuário preenche credenciais inválidas
**When** clica em "Salvar Configuração"
**Then** a validação falha
**And** uma mensagem de erro específica é exibida
**And** as credenciais NÃO são salvas
**And** o status permanece "Pendente"

#### Scenario: View Current Configuration
**Given** existem credenciais configuradas
**When** o usuário acessa a página
**Then** o App ID é exibido parcialmente mascarado
**And** o App Secret é exibido como ********
**And** o Access Token é exibido como ********
**And** o Ad Account ID é exibido completo
**And** a data da última sincronização é mostrada

### Requirement: Sidebar Navigation
O menu lateral MUST incluir acesso ao módulo Meta Ads.

#### Scenario: Display Meta Ads Menu Item
**Given** o usuário está em qualquer página do BI
**When** visualiza a sidebar
**Then** existe uma seção "Configurações" no menu
**And** dentro dela existe o item "Meta Ads"
**And** o item exibe ícone apropriado (Facebook/Meta logo)

#### Scenario: Active State Navigation
**Given** o usuário está na página Meta Ads
**When** visualiza a sidebar
**Then** o item "Meta Ads" está destacado como ativo
**And** a seção "Configurações" está expandida

#### Scenario: Configuration Status Badge
**Given** o Meta Ads está configurado
**When** o usuário visualiza a sidebar
**Then** um badge verde indica "Ativo"
**And** se não configurado, badge amarelo indica "Pendente"
**And** se com erro, badge vermelho indica "Erro"

### Requirement: Meta Ads Backend API
O backend MUST expor endpoints para gerenciamento da configuração Meta Ads.

#### Scenario: Get Configuration Status
**Given** o frontend requisita GET /api/meta/config
**When** a requisição é processada
**Then** retorna status: 'configured' | 'pending' | 'error'
**And** retorna dados parcialmente mascarados (app_id, ad_account_id)
**And** retorna lastSync timestamp se configurado

#### Scenario: Save Configuration
**Given** o frontend envia POST /api/meta/config com credenciais
**When** a requisição é processada
**Then** app_secret e access_token são criptografados
**And** dados são persistidos
**And** retorna success: true com novo status

#### Scenario: Validate Configuration
**Given** o frontend envia POST /api/meta/validate
**When** a requisição é processada
**Then** tenta conexão com Graph API
**And** retorna { valid: boolean, error?: string }
**And** se válido, retorna informações básicas da conta

### Requirement: Credential Security
As credenciais do Meta Ads MUST ser armazenadas de forma segura.

#### Scenario: Encrypt Sensitive Data
**Given** credenciais são submetidas para salvamento
**When** o backend processa
**Then** app_secret é criptografado com AES-256
**And** access_token é criptografado com AES-256
**And** a chave de criptografia vem de variável de ambiente
**And** dados em plaintext NUNCA são logados

#### Scenario: Decrypt for API Calls
**Given** uma chamada à Graph API é necessária
**When** o serviço precisa das credenciais
**Then** access_token é descriptografado em memória
**And** usado apenas para a chamada
**And** não é persistido descriptografado

---

## Future Requirements (Fase 2 - Não implementar agora)

### Requirement: Campaign Data Fetch
O sistema poderá buscar dados de campanhas do Meta Ads.

#### Scenario: Sync Campaigns
**Given** credenciais válidas configuradas
**When** sincronização é executada
**Then** busca campanhas dos últimos 30 dias
**And** armazena em cache local
**And** atualiza lastSync timestamp

### Requirement: Ad Insights Integration
O sistema poderá exibir métricas de anúncios.

#### Scenario: Display Campaign Metrics
**Given** existem campanhas sincronizadas
**When** o usuário acessa dashboard Meta Ads
**Then** exibe: spend, impressions, clicks, CTR, CPL
**And** permite filtro por período
**And** correlaciona com leads do Bitrix

---

## API Specification

### GET /api/meta/config
```json
// Response
{
  "success": true,
  "data": {
    "status": "configured" | "pending" | "error",
    "appId": "12345*****",
    "adAccountId": "act_123456789",
    "pixelId": "987654321" | null,
    "lastSync": "2024-01-15T10:30:00Z" | null,
    "error": "Token expired" | null
  }
}
```

### POST /api/meta/config
```json
// Request
{
  "appId": "1234567890",
  "appSecret": "abc123...",
  "accessToken": "EAAGm...",
  "adAccountId": "act_123456789",
  "pixelId": "987654321"
}

// Response
{
  "success": true,
  "data": {
    "status": "configured",
    "message": "Configuração salva com sucesso"
  }
}
```

### POST /api/meta/validate
```json
// Request
{
  "appId": "1234567890",
  "appSecret": "abc123...",
  "accessToken": "EAAGm..."
}

// Response
{
  "success": true,
  "data": {
    "valid": true,
    "accountName": "Grupo Crepaldi",
    "tokenExpiry": "2024-02-15T00:00:00Z"
  }
}
```

---

## UI Design Notes

### Configuration Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│  ← Meta Ads Configuration                    [Status Badge] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Status da Integração                               │   │
│  │  ○ Pendente de configuração                         │   │
│  │  ● Configurado (Última sync: há 2 horas)           │   │
│  │  ○ Erro: Token expirado                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Credenciais do Facebook App                        │   │
│  │                                                     │   │
│  │  App ID                                             │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ 1234567890                                    │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │  App Secret                                         │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ ••••••••••••••••••••                          │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │  Access Token                                       │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ ••••••••••••••••••••                          │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │  Ad Account ID                                      │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ act_123456789                                 │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │                                                     │   │
│  │  [Validar Conexão]      [Salvar Configuração]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⓘ Instruções                                       │   │
│  │                                                     │   │
│  │  1. Acesse developers.facebook.com                  │   │
│  │  2. Crie ou selecione seu App                       │   │
│  │  3. Copie App ID e App Secret                       │   │
│  │  4. Gere um Access Token com permissões ads_read    │   │
│  │  5. Encontre seu Ad Account ID no Gerenciador       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Notes

### Environment Variables
```env
# Meta Ads
META_ENCRYPTION_KEY=<32-byte-hex-key>
```

### Graph API Version
- Use v18.0 ou superior
- Endpoint base: https://graph.facebook.com/v18.0

### Required Permissions
- ads_read (leitura de campanhas)
- ads_management (opcional, para futuras features)
- pages_read_engagement (para Pixel)
