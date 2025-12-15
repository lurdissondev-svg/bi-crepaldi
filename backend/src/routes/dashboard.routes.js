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
