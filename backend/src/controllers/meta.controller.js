import { metaAdsService } from '../services/meta.service.js';
import logger from '../utils/logger.js';

// In-memory storage for config (in production, use database)
let storedConfig = null;

/**
 * Get Meta Ads configuration
 */
export async function getConfig(req, res) {
  try {
    const config = metaAdsService.getConfig();

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Error getting Meta Ads config:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter configuração',
    });
  }
}

/**
 * Save Meta Ads configuration
 */
export async function saveConfig(req, res) {
  try {
    const { appId, appSecret, accessToken, adAccountId, pixelId } = req.body;

    if (!appId || !appSecret || !accessToken || !adAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios não preenchidos',
      });
    }

    // Store config
    storedConfig = {
      appId,
      appSecret,
      accessToken,
      adAccountId,
      pixelId: pixelId || null,
      status: 'configured',
      lastSync: new Date().toISOString(),
    };

    // Initialize service with new config
    metaAdsService.setConfig(storedConfig);

    logger.info('Meta Ads configuration saved successfully');

    res.json({
      success: true,
      data: metaAdsService.getConfig(),
    });
  } catch (error) {
    logger.error('Error saving Meta Ads config:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao salvar configuração',
    });
  }
}

/**
 * Validate Meta Ads credentials
 */
export async function validateConfig(req, res) {
  try {
    const { appId, appSecret, accessToken, adAccountId } = req.body;

    if (!appId || !appSecret || !accessToken || !adAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios não preenchidos',
      });
    }

    const result = await metaAdsService.validateCredentials({
      appId,
      appSecret,
      accessToken,
      adAccountId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error validating Meta Ads config:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao validar configuração',
    });
  }
}

/**
 * Get Meta Ads insights
 */
export async function getInsights(req, res) {
  try {
    const { data_inicio, data_fim, breakdown = 'campaign' } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Datas de início e fim são obrigatórias',
      });
    }

    const insights = await metaAdsService.getInsights(
      { start: data_inicio, end: data_fim },
      breakdown
    );

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    logger.error('Error fetching Meta Ads insights:', error);

    if (error.message === 'Meta Ads não está configurado') {
      return res.status(400).json({
        success: false,
        error: 'Meta Ads não está configurado',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao obter insights',
    });
  }
}

/**
 * Get Meta Ads campaigns
 */
export async function getCampaigns(req, res) {
  try {
    const { status = 'ACTIVE' } = req.query;

    const campaigns = await metaAdsService.getCampaigns(status);

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    logger.error('Error fetching Meta Ads campaigns:', error);

    if (error.message === 'Meta Ads não está configurado') {
      return res.status(400).json({
        success: false,
        error: 'Meta Ads não está configurado',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao obter campanhas',
    });
  }
}

/**
 * Get Meta Ads summary
 */
export async function getSummary(req, res) {
  try {
    const { data_inicio, data_fim } = req.query;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Datas de início e fim são obrigatórias',
      });
    }

    const summary = await metaAdsService.getSummary({
      start: data_inicio,
      end: data_fim,
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Error fetching Meta Ads summary:', error);

    if (error.message === 'Meta Ads não está configurado') {
      return res.status(400).json({
        success: false,
        error: 'Meta Ads não está configurado',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao obter resumo',
    });
  }
}

// Initialize service with stored config on startup
export function initMetaAds() {
  if (storedConfig) {
    metaAdsService.setConfig(storedConfig);
    logger.info('Meta Ads service initialized with stored config');
  }
}
