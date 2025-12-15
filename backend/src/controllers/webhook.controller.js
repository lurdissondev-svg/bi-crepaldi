/**
 * Webhook Controller
 * Recebe webhooks de integrações externas
 */

import tintimService from '../services/integrations/tintim.service.js';
import logger from '../utils/logger.js';

const webhookController = {
  /**
   * Recebe webhook do Tintim
   * POST /webhooks/tintim
   */
  async tintimWebhook(req, res) {
    try {
      // Verificar se integração está habilitada
      if (!tintimService.isEnabled()) {
        logger.warn('[Webhook] Tintim webhook recebido mas integração está desabilitada');
        return res.status(200).json({
          success: true,
          message: 'Webhook recebido (integração desabilitada)'
        });
      }

      // Validar assinatura (se configurada)
      const signature = req.headers['x-tintim-signature'];
      if (signature) {
        const isValid = tintimService.validateWebhookSignature(
          signature,
          JSON.stringify(req.body)
        );

        if (!isValid) {
          logger.warn('[Webhook] Assinatura Tintim inválida');
          return res.status(401).json({
            success: false,
            error: 'Assinatura inválida'
          });
        }
      }

      // Processar evento
      const result = await tintimService.processWebhookEvent(req.body);

      res.json({
        success: true,
        message: 'Webhook processado com sucesso',
        ...result
      });
    } catch (error) {
      logger.error('[Webhook] Erro ao processar Tintim webhook:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao processar webhook',
        message: error.message
      });
    }
  },

  /**
   * Health check do webhook
   * GET /webhooks/health
   */
  async health(req, res) {
    res.json({
      success: true,
      integrations: {
        tintim: {
          enabled: tintimService.isEnabled(),
          status: tintimService.isEnabled() ? 'active' : 'inactive'
        }
      },
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Recebe webhook genérico (para outras integrações futuras)
   * POST /webhooks/:provider
   */
  async genericWebhook(req, res) {
    const { provider } = req.params;

    logger.info(`[Webhook] Recebido de provider: ${provider}`);

    // Por enquanto apenas loga
    // Pode ser expandido para outras integrações

    res.json({
      success: true,
      message: `Webhook de ${provider} recebido`,
      timestamp: new Date().toISOString()
    });
  }
};

export default webhookController;
