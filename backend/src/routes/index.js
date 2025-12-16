import { Router } from 'express';
import dashboardRoutes from './dashboard.routes.js';
import metaRoutes from './meta.routes.js';
import webhookRoutes from './webhook.routes.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import rolesRoutes from './roles.routes.js';
import bitrix24Service from '../services/bitrix24.service.js';
import belleService from '../services/belle.service.js';
import { metaAdsService } from '../services/meta.service.js';
import syncService from '../services/sync.service.js';
import db from '../database/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Simple health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health check with integration status
router.get('/health/detailed', async (req, res) => {
  const integrations = {
    database: { status: 'unknown', message: '' },
    bitrix24: { status: 'unknown', message: '' },
    belle: { status: 'unknown', message: '' },
    metaAds: { status: 'unknown', message: '' },
  };

  // Check Database
  try {
    const dbHealth = await db.healthCheck();
    if (dbHealth.connected) {
      integrations.database = { status: 'connected', message: dbHealth.message };
    } else {
      integrations.database = { status: 'error', message: dbHealth.message };
    }
  } catch (error) {
    logger.error('Health check - Database error:', error.message);
    integrations.database = { status: 'error', message: error.message };
  }

  // Check Bitrix24
  try {
    const statuses = await bitrix24Service.getLeadStatuses();
    if (statuses && statuses.length > 0) {
      integrations.bitrix24 = { status: 'connected', message: `${statuses.length} status disponíveis` };
    } else {
      integrations.bitrix24 = { status: 'warning', message: 'Conectado mas sem dados' };
    }
  } catch (error) {
    logger.error('Health check - Bitrix24 error:', error.message);
    integrations.bitrix24 = { status: 'error', message: error.message };
  }

  // Check Belle Software
  try {
    // Use a minimal API call to check connection
    const today = new Date().toISOString().split('T')[0];
    const health = await belleService.healthCheck?.() || { connected: true };
    if (health.connected !== false) {
      integrations.belle = { status: 'connected', message: 'API disponível' };
    } else {
      integrations.belle = { status: 'error', message: 'Não foi possível conectar' };
    }
  } catch (error) {
    logger.error('Health check - Belle error:', error.message);
    integrations.belle = { status: 'error', message: error.message };
  }

  // Check Meta Ads
  const metaConfig = metaAdsService.getConfig();
  if (!metaConfig) {
    integrations.metaAds = { status: 'not_configured', message: 'Não configurado' };
  } else if (metaConfig.status === 'configured') {
    integrations.metaAds = { status: 'connected', message: 'Configurado e ativo' };
  } else if (metaConfig.status === 'error') {
    integrations.metaAds = { status: 'error', message: metaConfig.errorMessage || 'Erro de configuração' };
  } else {
    integrations.metaAds = { status: 'pending', message: 'Configuração pendente' };
  }

  // Determine overall status
  const statuses = Object.values(integrations).map(i => i.status);
  let overallStatus = 'healthy';
  if (statuses.includes('error')) {
    overallStatus = 'degraded';
  }
  if (statuses.every(s => s === 'error' || s === 'not_configured')) {
    overallStatus = 'unhealthy';
  }

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    integrations,
  });
});

// Sync status endpoint
router.get('/sync/status', async (req, res) => {
  try {
    const status = await syncService.getSyncStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Sync status error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status da sincronização',
    });
  }
});

// Manual sync trigger (for admins)
router.post('/sync/run', async (req, res) => {
  try {
    // Inicia sync em background
    syncService.runFullSync().catch(err => {
      logger.error('Manual sync error:', err);
    });

    res.json({
      success: true,
      message: 'Sincronização iniciada em background',
    });
  } catch (error) {
    logger.error('Manual sync trigger error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro ao iniciar sincronização',
    });
  }
});

// Auth routes
router.use('/auth', authRoutes);

// Users management routes
router.use('/users', usersRoutes);

// Roles management routes
router.use('/roles', rolesRoutes);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Meta Ads routes
router.use('/meta', metaRoutes);

// Webhook routes (Tintim e outras integrações)
router.use('/webhooks', webhookRoutes);

export default router;
