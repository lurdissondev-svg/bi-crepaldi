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

// Opções de filtro
router.get('/filtros', cacheMiddleware(cacheKey), dashboardController.getFilterOptions);

// Status do sync (sem cache pois muda constantemente)
router.get('/sync-status', dashboardController.getSyncStatus);

export default router;
