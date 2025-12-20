import { Router } from 'express';
import customerEnrichmentService from '../services/customer-enrichment.service.js';
import syncService from '../services/sync.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/admin/enrich-customers
 * Dispara o enriquecimento de clientes manualmente
 */
router.post('/enrich-customers', async (req, res) => {
  try {
    const { limit = 100, dryRun = false } = req.body;

    logger.info(`[Enrichment API] Enriquecimento manual solicitado (limit=${limit}, dryRun=${dryRun})`);

    // Executa em background para não bloquear a resposta
    const resultPromise = customerEnrichmentService.runEnrichment({
      limit: Math.min(limit, 500), // Limita a 500 por segurança
      dryRun,
    });

    // Se dryRun, aguarda resultado para retornar preview
    if (dryRun) {
      const result = await resultPromise;
      return res.json({
        success: true,
        message: 'Preview do enriquecimento (dry-run)',
        data: result,
      });
    }

    // Senão, retorna imediatamente e processa em background
    resultPromise.catch(err => {
      logger.error('[Enrichment API] Erro no enriquecimento manual:', err.message);
    });

    res.json({
      success: true,
      message: 'Enriquecimento iniciado em background',
      info: {
        limit,
        dryRun,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Enrichment API] Erro ao iniciar enriquecimento:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao iniciar enriquecimento de clientes',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/enrich-customers/status
 * Retorna status da última execução de enriquecimento
 */
router.get('/enrich-customers/status', async (req, res) => {
  try {
    const lastRun = customerEnrichmentService.getLastRunStatus();

    res.json({
      success: true,
      data: lastRun || {
        message: 'Nenhum enriquecimento executado ainda',
      },
    });
  } catch (error) {
    logger.error('[Enrichment API] Erro ao obter status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status do enriquecimento',
    });
  }
});

/**
 * GET /api/admin/enrich-customers/stats
 * Retorna estatísticas de qualidade dos dados de contato
 */
router.get('/enrich-customers/stats', async (req, res) => {
  try {
    const stats = await customerEnrichmentService.getDataQualityStats();

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao calcular estatísticas',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[Enrichment API] Erro ao obter estatísticas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas de qualidade de dados',
    });
  }
});

/**
 * GET /api/admin/enrich-customers/history
 * Retorna histórico de enriquecimentos
 */
router.get('/enrich-customers/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const history = await customerEnrichmentService.getEnrichmentHistory(
      Math.min(parseInt(limit) || 50, 200)
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    logger.error('[Enrichment API] Erro ao obter histórico:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter histórico de enriquecimento',
    });
  }
});

export default router;
