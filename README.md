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
  - Leads com UTM tracking
  - Deals e estágios de venda
  - Status e conversões
  - Fontes de origem

- **Belle Software API**
  - Faturamento e vendas
  - Procedimentos
  - Profissionais
  - Pacientes/Clientes
  - Centros de custo

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

## Fontes de Referência

- [Bitrix24 REST API](https://apidocs.bitrix24.com/)
- [Belle Software](https://www.bellesoftware.com.br/)
- [Recharts](https://recharts.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## Licença

Proprietário - Grupo Crepaldi
