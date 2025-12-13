# Proposal: Enhance Marketing BI with Meta Ads Integration

## Change ID
`enhance-marketing-bi-meta-integration`

## Summary
Aprimorar o BI Crepaldi para ser 100% assertivo em dados de marketing, corrigindo todas as rotas da API, removendo dados mockados, e adicionando uma nova aba de configuração para integração futura com Meta Ads (Facebook/Instagram Ads) via Graph API.

## Problem Statement

### Problemas Identificados

1. **Dados Mockados no Frontend**: A página de Marketing (`MarketingPage.tsx`) usa dados mock hardcoded em vez de consumir dados reais da API:
   - `mockHorarioChegada`: Dados estáticos de horários de leads
   - `mockTaxaConversao`: Tabela de conversão com dados fixos
   - `mockTotalLeads`: Distribuição de leads fake

2. **Placeholders no Backend**: O controller (`dashboard.controller.js`) contém vários cálculos placeholder:
   - Pacientes recorrentes calculados como 30% dos novos (linha 49-52)
   - Percentuais de pacientes novos hardcoded (linha 166-167)
   - Valores de metas fixos sem integração real

3. **Falta de Rastreamento UTM Completo**: Não há correlação efetiva entre:
   - Leads do Bitrix24 com parâmetros UTM
   - Vendas/Faturamento do Belle Software
   - Origem real das conversões

4. **Ausência de Integração Meta Ads**: Não existe módulo para:
   - Configurar credenciais do Facebook Graph API
   - Visualizar métricas de campanhas
   - Correlacionar gastos em ads com leads/vendas

5. **Dados Inconsistentes**: Falta de validação e tratamento de erros nas APIs, causando dados zerados ou inconsistentes.

## Proposed Solution

### Fase 1: Correção de Rotas e Dados Reais
- Remover todos os dados mockados do frontend
- Implementar consumo real de dados da API em todas as páginas
- Corrigir cálculos de pacientes novos vs recorrentes no backend
- Adicionar validações e tratamento de erros robusto

### Fase 2: Aprimoramento do Dashboard de Marketing
- Implementar tracking UTM completo
- Criar correlação leads → deals → vendas
- Adicionar métricas de ROI por fonte de tráfego
- Implementar funil de conversão visual

### Fase 3: Módulo Meta Ads (Preparação)
- Criar nova aba "Configurações Meta Ads" na sidebar
- Implementar tela de configuração para credenciais
- Estruturar backend para futura integração com Graph API
- Preparar tipos e interfaces para dados de campanhas

### Fase 4: Precisão e Assertividade
- Implementar validação de dados na camada de serviço
- Adicionar logs detalhados para debugging
- Criar testes de integração para APIs
- Implementar health check detalhado por integração

## Scope

### In Scope
- Correção de todas as rotas de dashboard
- Remoção de dados mockados
- Nova aba de configurações Meta Ads
- Estrutura para integração futura Graph API
- Melhorias no tracking UTM
- Correlação Bitrix24 ↔ Belle Software

### Out of Scope
- Implementação completa da integração Graph API (será feita posteriormente)
- Modificações no Bitrix24 ou Belle Software
- Autenticação OAuth com Facebook (requer app aprovado)
- Mobile responsive redesign

## Success Criteria
1. Zero dados mockados no frontend
2. 100% das rotas retornando dados reais e validados
3. Taxa de conversão calculada com precisão (leads → vendas)
4. Aba Meta Ads funcional com tela de configuração
5. Logs estruturados para auditoria de dados
6. Documentação de APIs atualizada

## Dependencies
- Acesso válido às APIs Bitrix24 e Belle Software
- Credenciais de ambiente configuradas corretamente
- Futuramente: Facebook Developer App aprovado para Graph API

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API Belle indisponível | Alto | Cache agressivo + fallback graceful |
| Dados UTM incompletos no Bitrix | Médio | Classificar como "Não identificado" |
| Rate limit APIs | Médio | Implementar queue com backoff |
| Divergência de dados | Alto | Validação cruzada + alertas |

## Stakeholders
- Equipe de Marketing (usuários principais)
- Gestão Comercial (análise de ROI)
- TI (manutenção e integrações)
