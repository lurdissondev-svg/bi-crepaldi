# BI Crepaldi - Sistema de Business Intelligence

Sistema de Business Intelligence moderno para análise de dados financeiros e de marketing, integrando **Belle Software** (dados financeiros) e **Bitrix24** (dados de marketing/CRM).

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
├── frontend/                # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   │   ├── charts/     # Gráficos (Recharts)
│   │   │   ├── dashboard/  # Cards e métricas
│   │   │   ├── filters/    # Filtros
│   │   │   └── layout/     # Layout (Sidebar, Header)
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Páginas do dashboard
│   │   ├── services/       # API client
│   │   ├── styles/         # CSS/Tailwind
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
3. **Marketing** - Leads por horário, origem, taxa de conversão, UTM tracking
4. **Comercial** - Conversão por origem, metas, performance de profissionais
5. **Atendimento** - Desempenho de responsáveis, ticket médio, análise 80/20
6. **Administrativo Financeiro** - Métricas financeiras consolidadas
7. **Quadro de Metas** - Acompanhamento de metas SPA
8. **Pacientes** - Faturamento por paciente, pacientes potenciais

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
- Node.js + Express
- Axios (requisições HTTP)
- Node-cache (cache em memória)
- Winston (logging)
- date-fns (manipulação de datas)

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Recharts (gráficos)
- React Router
- Axios
- Lucide Icons

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

## Licença

Proprietário - Grupo Crepaldi
