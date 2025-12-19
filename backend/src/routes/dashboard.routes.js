import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller.js';
import { cacheMiddleware } from '../utils/cache.js';

const router = Router();

// Cache de 5 minutos para todas as rotas
const cacheKey = (req) => `dashboard-${req.path}-${JSON.stringify(req.query)}`;

// Rotas do Dashboard
router.get('/resumo', cacheMiddleware(cacheKey), dashboardController.getResumo);
router.get('/faturamento', cacheMiddleware(cacheKey), dashboardController.getFaturamento);
router.get('/marketing', cacheMiddleware(cacheKey), dashboardController.getMarketing);
router.get('/comercial', cacheMiddleware(cacheKey), dashboardController.getComercial);
router.get('/atendimento', cacheMiddleware(cacheKey), dashboardController.getAtendimento);
router.get('/metas', cacheMiddleware(cacheKey), dashboardController.getMetas);
router.get('/pacientes', cacheMiddleware(cacheKey), dashboardController.getPacientes);
router.get('/lead-sale-correlation', cacheMiddleware(cacheKey), dashboardController.getLeadSaleCorrelation);

// Customer Analytics (Phase 2)
router.get('/conversion-metrics', cacheMiddleware(cacheKey), dashboardController.getConversionMetrics);
router.get('/conversion-funnel', cacheMiddleware(cacheKey), dashboardController.getConversionFunnel);
router.get('/returning-customers', cacheMiddleware(cacheKey), dashboardController.getReturningCustomerStats);
router.get('/rfm-segmentation', cacheMiddleware(cacheKey), dashboardController.getRFMSegmentation);
router.get('/top-customers-ltv', cacheMiddleware(cacheKey), dashboardController.getTopCustomersByLTV);
router.get('/inactive-patients', cacheMiddleware(cacheKey), dashboardController.getInactivePatients);
router.get('/inactive-patients-dynamic', cacheMiddleware(cacheKey), dashboardController.getInactivePatientsDynamic);
router.get('/patients-overdue', cacheMiddleware(cacheKey), dashboardController.getPatientsOverdueForReturn);
router.get('/churn-risk-summary', cacheMiddleware(cacheKey), dashboardController.getChurnRiskSummary);

// Phase 3 & 4: Marketing KPIs e Customer LTV
router.get('/conversion-time', cacheMiddleware(cacheKey), dashboardController.getConversionTime);
router.get('/marketing-roas', cacheMiddleware(cacheKey), dashboardController.getMarketingROAS);
router.get('/advanced-funnel', cacheMiddleware(cacheKey), dashboardController.getAdvancedFunnel);
router.get('/campaign-attribution', cacheMiddleware(cacheKey), dashboardController.getCampaignAttribution);
router.get('/customer-ltv', cacheMiddleware(cacheKey), dashboardController.getCustomerLTV);
router.get('/voucher-analytics', cacheMiddleware(cacheKey), dashboardController.getVoucherAnalytics);
router.get('/recurrence-metrics', cacheMiddleware(cacheKey), dashboardController.getRecurrenceMetrics);
router.get('/return-customer-stats', cacheMiddleware(cacheKey), dashboardController.getReturnCustomerStats);
router.get('/funnel-comparison', cacheMiddleware(cacheKey), dashboardController.getFunnelComparison);

// Novos Indicadores da Apresentação (Gestão por Blocos Operacionais)
router.get('/retention-rescue', cacheMiddleware(cacheKey), dashboardController.getRetentionRescue);
router.get('/faturamento-medico', cacheMiddleware(cacheKey), dashboardController.getFaturamentoMedico);
router.get('/faturamento-servico', cacheMiddleware(cacheKey), dashboardController.getFaturamentoServico);
router.get('/ticket-medio-tipo', cacheMiddleware(cacheKey), dashboardController.getTicketMedioTipo);
router.get('/conversao-canal', cacheMiddleware(cacheKey), dashboardController.getConversaoCanal);
router.get('/no-show', cacheMiddleware(cacheKey), dashboardController.getNoShow);
router.get('/conversao-propostas', cacheMiddleware(cacheKey), dashboardController.getConversaoPropostas);
router.get('/cac-canal', cacheMiddleware(cacheKey), dashboardController.getCACCanal);

// Opções de filtro
router.get('/filtros', cacheMiddleware(cacheKey), dashboardController.getFilterOptions);

// Status do sync (sem cache pois muda constantemente)
router.get('/sync-status', dashboardController.getSyncStatus);

// Clear all caches
router.post('/clear-cache', dashboardController.clearCache);

// Backfill de dados históricos (para importar histórico para o banco)
router.post('/backfill', dashboardController.runBackfill);
router.post('/backfill/current-year', dashboardController.runBackfillCurrentYear);

export default router;
