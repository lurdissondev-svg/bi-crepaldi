# BI Crepaldi - Sistema de Business Intelligence

[![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)](CHANGELOG.md)
[![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D.svg)](https://vuejs.org/)
[![Node](https://img.shields.io/badge/Node-18+-339933.svg)](https://nodejs.org/)

Sistema de Business Intelligence moderno para análise de dados financeiros e de marketing, integrando **Belle Software** (dados financeiros), **Bitrix24** (dados de marketing/CRM) e **Meta Ads** (campanhas digitais).

Implementa a metodologia **8Ps do Marketing Digital** (Conrado Adolpho) com 17 indicadores de geração de caixa.

## Arquitetura

```
BI CREPALDI/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Configurações
│   │   ├── controllers/    # Controllers da API
│   │   ├── middleware/     # Middlewares
│   │   ├── routes/         # Rotas da API
│   │   ├── services/       # Integrações (Bitrix24, Belle)
│   │   └── utils/          # Utilitários
│   └── package.json
│
├── frontend/                # Vue 3 + Vite + Tailwind + TypeScript
│   ├── src/
│   │   ├── components/     # Componentes Vue
│   │   │   ├── charts/     # Gráficos (Chart.js)
│   │   │   ├── dashboard/  # Cards e métricas
│   │   │   ├── filters/    # Filtros
│   │   │   ├── layout/     # Layout (Sidebar, Header)
│   │   │   ├── navigation/ # Navegação
│   │   │   └── ui/         # Componentes UI reutilizáveis
│   │   ├── stores/         # Pinia stores
│   │   ├── pages/          # Páginas do dashboard
│   │   ├── services/       # API client com cache
│   │   ├── styles/         # CSS/Tailwind com tema escuro
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilitários
│   └── package.json
│
└── README.md
```

## Funcionalidades

### Dashboards

1. **Resumo** - Visão geral com faturamento, pacientes novos/recorrentes, desempenho por dezena
2. **Faturamento** - Análise financeira mensal/anual, crescimento, faturamento diário
3. **Marketing** - Leads por horário, origem, taxa de conversão, UTM tracking, **indicadores 8Ps**
4. **Comercial** - Conversão por origem, metas, performance de profissionais
5. **Atendimento** - Desempenho de responsáveis, ticket médio, análise 80/20
6. **Administrativo Financeiro** - Métricas financeiras consolidadas
7. **Quadro de Metas** - Acompanhamento de metas SPA
8. **Pacientes** - Faturamento por paciente, pacientes potenciais, segmentação RFM

### Indicadores 8Ps (Metodologia Conrado Adolpho)

O sistema implementa os **17 indicadores da geração de caixa** organizados por departamento:

| Departamento | Indicadores Principais |
|--------------|------------------------|
| **FIN** (Financeiro) | Faturamento, Investimento, Lucro, ROAS, Margem |
| **MKT** (Marketing) | Leads, CPL, CTR, TX1 (Clique→Lead), Taxa Qualificação |
| **COM1** (Comercial Aquisição) | Agendamentos, CAC, TX2 (Lead→Venda), Ticket Médio |
| **COM2** (Comercial Recorrência) | LTV, LTV:CAC, Taxa Recompra, Churn |

**Funcionalidades do painel 8Ps:**
- Saúde do marketing por departamento (verde/amarelo/vermelho)
- Alertas automáticos com ações recomendadas
- CAC por canal de aquisição
- Funil de conversão comparativo (período atual vs anterior)
- Performance por fonte de tráfego
- Análise cruzada Origem x Campanha

### Integrações

- **Bitrix24 CRM API**
  - Leads com UTM tracking (Source, Medium, Campaign)
  - Deals e estágios de venda
  - Status e conversões com semântica (Processo/Sucesso/Falha)
  - Fontes de origem
  - Funil de conversão de leads
  - Correlação lead-to-sale

- **Belle Software API**
  - Faturamento e vendas
  - Procedimentos
  - Profissionais
  - Pacientes/Clientes
  - Centros de custo

- **Meta Ads API** (Configurável)
  - Integração com Facebook/Instagram Ads
  - Métricas de campanhas (impressões, cliques, conversões)
  - Custo por lead e ROI
  - Análise de performance por campanha

## Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Backend

```bash
cd backend
cp .env.example .env
# Configure as variáveis de ambiente
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuração

### Variáveis de Ambiente (Backend)

```env
# Servidor
PORT=3001
NODE_ENV=development

# Bitrix24
BITRIX24_WEBHOOK_URL=https://seu-dominio.bitrix24.com.br/rest/1/seu-webhook/
BITRIX24_DOMAIN=seu-dominio.bitrix24.com.br

# Belle Software
BELLE_API_URL=https://api.bellesoftware.com.br
BELLE_API_KEY=sua-api-key
BELLE_CLIENT_ID=seu-client-id
BELLE_CLIENT_SECRET=seu-client-secret

# Cache
CACHE_TTL=300

# CORS
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

### Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/resumo` | Dados do resumo geral |
| GET | `/api/dashboard/faturamento` | Análise de faturamento |
| GET | `/api/dashboard/marketing` | Dados de marketing/leads |
| GET | `/api/dashboard/comercial` | Dados comerciais |
| GET | `/api/dashboard/atendimento` | Performance de atendimento |
| GET | `/api/dashboard/metas` | Quadro de metas |
| GET | `/api/dashboard/pacientes` | Análise de pacientes |
| GET | `/api/dashboard/filtros` | Opções de filtros |
| GET | `/api/dashboard/lead-sale-correlation` | Correlação lead-venda |

### Indicadores 8Ps

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/8ps` | Indicadores principais por departamento |
| GET | `/api/dashboard/8ps/avancado` | Métricas avançadas 8Ps |
| GET | `/api/dashboard/8ps/campanhas` | Performance por campanha |
| GET | `/api/dashboard/8ps/gargalos` | Identificação de gargalos no funil |
| GET | `/api/dashboard/8ps/publicos` | Segmentação dos 9 públicos |
| GET | `/api/dashboard/8ps/alertas` | Alertas automáticos |
| GET | `/api/dashboard/8ps/saude` | Status de saúde por departamento |
| GET | `/api/dashboard/8ps/metas` | Metas configuráveis |

### Customer Analytics

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/marketing-roas` | ROAS por fonte de tráfego |
| GET | `/api/dashboard/funnel-comparison` | Funil comparativo de períodos |
| GET | `/api/dashboard/cac-canal` | CAC por canal de aquisição |
| GET | `/api/dashboard/customer-ltv` | LTV de clientes |
| GET | `/api/dashboard/recurrence-metrics` | Métricas de recorrência |
| GET | `/api/dashboard/churn-risk-summary` | Resumo de risco de churn |

### Meta Ads

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/meta/config` | Obter configuração Meta Ads |
| POST | `/api/meta/config` | Salvar configuração |
| POST | `/api/meta/validate` | Validar credenciais |
| GET | `/api/meta/insights` | Obter insights de campanhas |
| GET | `/api/meta/campaigns` | Listar campanhas |
| GET | `/api/meta/summary` | Resumo de métricas |

### Health Check

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Status básico do servidor |
| GET | `/api/health/detailed` | Status detalhado com integrações |

### Parâmetros de Query

- `data_inicio` - Data inicial (YYYY-MM-DD)
- `data_fim` - Data final (YYYY-MM-DD)
- `centros_custo` - IDs dos centros de custo (separados por vírgula)
- `profissional` - ID do profissional
- `confirmado` - Status de confirmação

## Tecnologias

### Backend
- Node.js 18+ com Express
- PostgreSQL (banco de dados)
- Axios (requisições HTTP)
- Node-cache (cache em memória)
- Winston (logging estruturado)
- date-fns (manipulação de datas)
- node-cron (agendamento de tarefas)

### Frontend
- Vue 3 (Composition API + Script Setup)
- TypeScript
- Vite 5
- Pinia (state management)
- Tailwind CSS (tema escuro nativo)
- Chart.js + vue-chartjs (gráficos)
- Vue Router 4
- Axios com interceptors
- Lucide Vue Next (ícones)

## Recursos dos Gráficos

- **AreaChart** - Gráfico de área para tendências
- **BarChart** - Gráfico de barras para comparações
- **LineChart** - Gráfico de linhas para séries temporais
- **PieChart** - Gráfico de pizza para proporções
- **GaugeChart** - Velocímetro para metas

## Personalização

### Temas

O sistema usa Tailwind CSS com tema escuro personalizado. As cores principais estão definidas em `tailwind.config.js`:

```js
colors: {
  primary: { ... },
  dark: {
    bg: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    text: '#f1f5f9',
    muted: '#94a3b8',
  },
}
```

### Componentes

Todos os componentes são modulares e reutilizáveis:

- `MetricCard` - Cards de métricas com variação
- `StatCard` - Cards de estatísticas simples
- `DataTable` - Tabelas de dados com paginação
- `FilterBar` - Barra de filtros configurável
- `ProgressBar` - Barra de progresso

## Desenvolvimento

```bash
# Backend com hot-reload
cd backend && npm run dev

# Frontend com hot-reload
cd frontend && npm run dev
```

## Build para Produção

```bash
# Backend
cd backend && npm start

# Frontend
cd frontend && npm run build
# Servir arquivos de dist/
```

## Configuração do Meta Ads

Para integrar com o Meta Ads (Facebook/Instagram), siga os passos:

1. **Criar App no Meta for Developers**
   - Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps)
   - Crie um novo app do tipo "Business"
   - Anote o App ID e App Secret

2. **Gerar Access Token**
   - No Graph API Explorer, gere um token com as permissões:
     - `ads_read`
     - `ads_management`
     - `read_insights`
     - `business_management`
   - Converta para token de longa duração (60 dias)

3. **Configurar no Sistema**
   - Acesse o menu "Configurações > Meta Ads"
   - Preencha App ID, App Secret, Access Token e Ad Account ID
   - Clique em "Testar Conexão" para validar
   - Salve a configuração

## Troubleshooting

### Erros Comuns

**API retornando 503 (Service Unavailable)**
- O Bitrix24 possui rate limiting. Aguarde alguns segundos e tente novamente.
- O sistema possui retry automático com backoff exponencial.

**Dados de marketing vazios**
- Verifique se há leads criados no período selecionado no Bitrix24.
- Confirme que o webhook do Bitrix24 está configurado corretamente.

**Erro de autenticação Belle Software**
- Verifique as credenciais no arquivo `.env`.
- Confirme que o Client ID e Secret estão corretos.

**Meta Ads: Token inválido**
- Tokens de acesso expiram após 60 dias.
- Gere um novo token no Graph API Explorer.
- Verifique se o App está em modo Live (não Development).

**Dados financeiros inconsistentes**
- O cache possui TTL de 5 minutos. Aguarde ou reinicie o backend.
- Verifique os centros de custo selecionados nos filtros.

### Verificando Status das Integrações

Acesse `/api/health/detailed` para ver o status de todas as integrações:

```json
{
  "status": "healthy",
  "integrations": {
    "bitrix24": { "status": "connected", "message": "15 status disponíveis" },
    "belle": { "status": "connected", "message": "API disponível" },
    "metaAds": { "status": "not_configured", "message": "Não configurado" }
  }
}
```

### Logs

Os logs são salvos com Winston e podem ser encontrados no console do backend. Para debug mais detalhado:

```bash
# Executar com logs verbose
DEBUG=* npm run dev
```

## Fontes de Referência

- [Bitrix24 REST API](https://apidocs.bitrix24.com/)
- [Belle Software](https://www.bellesoftware.com.br/)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis/)
- [Recharts](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Changelog

Veja o [CHANGELOG.md](CHANGELOG.md) para o histórico completo de alterações.

### Última Atualização (v2.5.0 - 21/12/2025)

- Implementação completa dos indicadores 8Ps (metodologia Conrado Adolpho)
- Painel de saúde do marketing com alertas automáticos
- CAC por canal de aquisição
- Funil de conversão comparativo
- Correções em cálculos de profissionais e pacientes novos

## Contribuição

Este é um projeto proprietário. Para contribuir, entre em contato com a equipe de desenvolvimento.

## Licença

Proprietário - Grupo Crepaldi
