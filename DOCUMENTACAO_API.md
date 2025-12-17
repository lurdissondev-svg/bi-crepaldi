# Documentacao APIs - BI Crepaldi

> Documentacao tecnica para continuidade do projeto por outra IA/desenvolvedor

---

## 1. CREDENCIAIS E CONFIGURACAO

### Belle Software API

```
Base URL: https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0
Token: f236029cecd084712f7b3ce12c3e0c14
Timeout: 60000ms (60 segundos)
```

**Autenticacao:**
- Header `Authorization` com o token diretamente (sem Bearer)
- Content-Type: `application/json`

**Exemplo de requisicao:**
```javascript
axios.create({
  baseURL: 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'f236029cecd084712f7b3ce12c3e0c14'
  }
});
```

### Bitrix24 API

```
Webhook URL: https://crepaldi.bitrix24.com.br/rest/77576/5kc3qf5zfmcvub44/
Domain: crepaldi.bitrix24.com.br
Timeout: 30000ms (30 segundos)
```

**Autenticacao:**
- Token embutido na URL do webhook (nao precisa header separado)
- Content-Type: `application/json`

**Exemplo de requisicao:**
```javascript
axios.create({
  baseURL: 'https://crepaldi.bitrix24.com.br/rest/77576/5kc3qf5zfmcvub44/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});
```

---

## 2. ESTABELECIMENTOS BELLE

A API Belle trabalha com multiplos estabelecimentos (unidades de negocio):

| ID | Nome |
|----|------|
| 1 | Dermato |
| 2 | SPA |
| 5 | Convenio |
| 10 | Drips |
| 11 | Estetica |
| 12 | Bela Laser |
| 14 | Nutrologia |

**IDs usados:** `1,2,5,10,11,12,14`

---

## 3. ENDPOINTS BELLE - DETALHAMENTO

### 3.1 Clientes

**Listar todos os clientes (paginado):**
```
GET /clientes?codEstab={id}&pagina={numero}
```
- Retorna 100 itens por pagina
- Delay de 500ms entre requisicoes recomendado

**Buscar cliente especifico:**
```
GET /cliente/listar?codEstab={id}&id={clienteId}
```

### 3.2 Vendas

**Vendas por periodo:**
```
GET /vendas?estab={id}&dtInicio={dd/MM/yyyy}&dtFim={dd/MM/yyyy}
```

**Vendas detalhadas:**
```
GET /vendas/detalhado?estab={id}&dtInicio={dd/MM/yyyy}&dtFim={dd/MM/yyyy}
```

### 3.3 Financeiro

**Contas a receber (MAIS USADO PARA FATURAMENTO):**
```
GET /contas_receber?estab={id}&dtInicio={dd/MM/yyyy}&dtFim={dd/MM/yyyy}&tipoData={tipo}
```
- tipoData: 'vencimento' ou 'pagamento'

**Saldo de contas:**
```
GET /financeiro/saldo_contas?codEstab={id}&ano={yyyy}
```

**Plano de contas:**
```
GET /financeiro/plano_contas
```

**Formas de pagamento:**
```
GET /financeiro/formas_pagamento
```

### 3.4 Profissionais

```
GET /profissionais?codEstab={id}
```

### IMPORTANTE - Formato de Data Belle

A API Belle usa formato **dd/MM/yyyy** (brasileiro).
Conversao necessaria de ISO (YYYY-MM-DD) para esse formato.

```javascript
// Exemplo de conversao
function formatDateBelle(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
```

### LIMITACAO - Periodo Maximo 3 Meses

A API Belle tem limitacao de maximo 3 meses por requisicao.
O sistema atual divide periodos maiores em chunks de 3 meses.

---

## 4. ENDPOINTS BITRIX24 - DETALHAMENTO

### 4.1 Leads

**Listar leads:**
```
POST crm.lead.list
Body: { filter: {...}, select: [...], start: 0 }
```

**Campos disponiveis:**
```
POST crm.lead.fields
```

**Status de leads:**
```
POST crm.status.list
Body: { filter: { ENTITY_ID: 'STATUS' } }
```

**Campos importantes dos leads:**
- ID, TITLE, NAME, LAST_NAME
- STATUS_ID, SOURCE_ID
- OPPORTUNITY, CURRENCY_ID
- DATE_CREATE, DATE_MODIFY, DATE_CLOSED
- UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN, UTM_CONTENT, UTM_TERM
- PHONE, EMAIL

### 4.2 Deals (Negocios)

**Listar deals:**
```
POST crm.deal.list
Body: { filter: {...}, select: [...], start: 0 }
```

**Campos disponiveis:**
```
POST crm.deal.fields
```

**Estagios do pipeline:**
```
POST crm.category.list
Body: { entityTypeId: 2 }  // 2 = deals
```

**Campos importantes dos deals:**
- ID, TITLE, STAGE_ID, CATEGORY_ID
- OPPORTUNITY, CURRENCY_ID
- DATE_CREATE, CLOSEDATE
- CONTACT_ID, COMPANY_ID
- UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN

### 4.3 Contatos

```
POST crm.contact.list
Body: { filter: {...}, select: [...], start: 0 }
```

### PAGINACAO BITRIX

- 50 itens por requisicao
- Campo `next` na resposta indica proximo offset
- Delay de 500ms recomendado entre requisicoes (evita 503)

```javascript
// Exemplo de paginacao
async function getAllPaginated(method, params) {
  let all = [];
  let start = 0;

  while (true) {
    const response = await axios.post(method, { ...params, start });
    all = all.concat(response.data.result);

    if (!response.data.next) break;
    start = response.data.next;
    await delay(500);
  }

  return all;
}
```

### SEMANTICA DE STATUS BITRIX

- `S` = Sucesso/Convertido
- `F` = Falha/Desqualificado
- `P` = Em Processo

---

## 5. ARQUITETURA DO PROJETO

```
BI CREPALDI/
├── backend/
│   ├── src/
│   │   ├── config/index.js           # Configuracoes centralizadas
│   │   ├── controllers/
│   │   │   └── dashboard.controller.js  # Handlers dos endpoints
│   │   ├── routes/
│   │   │   ├── index.js              # Router principal
│   │   │   └── dashboard.routes.js   # Rotas /dashboard/*
│   │   ├── services/
│   │   │   ├── belle.service.js      # Cliente API Belle
│   │   │   └── bitrix24.service.js   # Cliente API Bitrix
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   ├── utils/
│   │   │   ├── cache.js              # Node-cache (TTL 5min)
│   │   │   ├── dateUtils.js          # Utilitarios de data
│   │   │   └── logger.js             # Winston logger
│   │   └── index.js                  # Entry point
│   ├── .env                          # Variaveis de ambiente
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── services/api.ts           # Cliente HTTP
│   │   ├── hooks/useDashboard.ts     # Hook de estado
│   │   ├── types/index.ts            # Tipos TypeScript
│   │   ├── components/               # Componentes React
│   │   ├── pages/                    # Paginas do dashboard
│   │   └── App.tsx                   # Rotas React
│   └── package.json
│
└── docker-compose.yml
```

---

## 6. ENDPOINTS DO BACKEND

**Base URL:** `http://localhost:3001/api`

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/dashboard/resumo` | GET | Visao geral |
| `/dashboard/faturamento` | GET | Receitas e faturamento |
| `/dashboard/marketing` | GET | Leads e conversao |
| `/dashboard/comercial` | GET | Vendas e metas |
| `/dashboard/atendimento` | GET | Performance operacional |
| `/dashboard/metas` | GET | Acompanhamento de metas |
| `/dashboard/pacientes` | GET | Analise de pacientes |
| `/dashboard/filtros` | GET | Opcoes de filtros |

**Query Parameters:**
- `data_inicio` (YYYY-MM-DD)
- `data_fim` (YYYY-MM-DD)
- `centros_custo` (IDs separados por virgula)
- `profissional` (ID)
- `confirmado` (status)

---

## 7. FLUXO DE DADOS

```
Frontend (React)
    |
    v
API Service (axios) - formata filtros
    |
    v
Backend Express (porta 3001)
    |
    v
Dashboard Controller
    |
    +---> BelleService -----> API Belle (faturamento)
    |                            |
    |                            v
    |                      Dados financeiros
    |
    +---> Bitrix24Service --> API Bitrix (leads/deals)
                                 |
                                 v
                           Dados marketing/vendas
    |
    v
Agregacao e processamento
    |
    v
Cache (node-cache, 5 min TTL)
    |
    v
Response JSON
```

---

## 8. VARIAVEIS DE AMBIENTE (.env)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Bitrix24
BITRIX24_WEBHOOK_URL=https://crepaldi.bitrix24.com.br/rest/77576/5kc3qf5zfmcvub44/
BITRIX24_DOMAIN=crepaldi.bitrix24.com.br

# Belle Software
BELLE_API_URL=https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0
BELLE_API_TOKEN=f236029cecd084712f7b3ce12c3e0c14
BELLE_ESTABELECIMENTOS=1,2,5,10,11,12,14

# Cache
CACHE_TTL=300

# CORS
FRONTEND_URL=http://localhost:5173
```

---

## 9. COMO EXECUTAR

### Desenvolvimento

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker-compose up --build
```

**Portas:**
- Backend: 3001
- Frontend: 80 (Docker) ou 5173 (dev)

---

## 10. PONTOS CRITICOS PARA CONTINUIDADE

### 10.1 APIs Externas

1. **Belle API** - Fonte principal de dados financeiros
   - Usado para: faturamento, vendas, contas a receber, pacientes
   - Limitacao: max 3 meses por request
   - Formato data: dd/MM/yyyy

2. **Bitrix24 API** - Fonte de dados de marketing/CRM
   - Usado para: leads, deals, conversao, UTM tracking
   - Paginacao: 50 itens por request
   - Rate limit: delay 500ms recomendado

### 10.2 Logica de Negocio Importante

- **Faturamento:** Vem de `contas_receber` da Belle (nao de vendas)
- **Leads convertidos:** STATUS_SEMANTIC_ID = 'S'
- **Periodos:** Frontend envia ISO, backend converte para formato Belle
- **Cache:** 5 minutos para evitar sobrecarga nas APIs

### 10.3 Melhorias Pendentes

1. Implementar refresh token para Bitrix (se necessario)
2. Adicionar mais filtros por profissional
3. Dashboard de comparativo ano a ano
4. Exportacao de relatorios PDF/Excel
5. Alertas de metas nao atingidas

---

## 11. DEPENDENCIAS PRINCIPAIS

### Backend
- express: ^4.18.2
- axios: ^1.6.2
- node-cache: ^5.1.2
- winston: ^3.11.0
- date-fns: ^2.30.0
- date-fns-tz: ^2.0.0

### Frontend
- react: ^18.2.0
- recharts: ^2.10.3
- axios: ^1.6.2
- tailwindcss: ^3.4.0
- typescript: ^5.2.2

---

## 12. CONTATOS/REFERENCIAS

- **Belle Software:** https://app.bellesoftware.com.br
- **Bitrix24:** https://crepaldi.bitrix24.com.br
- **Documentacao Bitrix REST API:** https://training.bitrix24.com/rest_help/

---

> **AVISO DE SEGURANCA:** As credenciais neste documento sao sensiveis.
> Recomenda-se rotacionar tokens apos compartilhamento e usar
> gerenciador de secrets em producao.
