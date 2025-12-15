/**
 * Tintim Integration Service
 *
 * Tintim (https://tintim.app) é uma ferramenta de rastreamento de conversões
 * via WhatsApp com integração Meta Ads.
 *
 * FUNCIONALIDADES DO TINTIM:
 * - Rastreamento de origem de conversas (UTM, campanha, anúncio)
 * - Classificação automática de leads via IA
 * - Identificação automática de vendas
 * - Envio de conversões para Meta Ads (CAPI)
 * - Webhooks para eventos (nova conversa, venda, mudança de status)
 *
 * PLANOS:
 * - Inicial: R$ 197/mês (rastreamento básico)
 * - Escala: R$ 297/mês (webhooks + Meta Ads integration)
 * - Agências: Descontos a partir de 65%
 *
 * COMO INTEGRAR:
 * 1. Criar conta em https://tintim.app
 * 2. Configurar webhook apontando para: {API_URL}/webhooks/tintim
 * 3. Configurar TINTIM_WEBHOOK_SECRET no .env
 * 4. Ativar a integração setando TINTIM_ENABLED=true
 *
 * @see https://tintim.app/central-de-ajuda/ para documentação
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';
import db from '../../database/index.js';

class TintimService {
  constructor() {
    this.enabled = process.env.TINTIM_ENABLED === 'true';
    this.webhookSecret = process.env.TINTIM_WEBHOOK_SECRET || '';
  }

  /**
   * Verifica se a integração está habilitada
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Valida assinatura do webhook do Tintim
   * @param {string} signature - Assinatura recebida no header
   * @param {string} payload - Corpo da requisição
   */
  validateWebhookSignature(signature, payload) {
    if (!this.webhookSecret) {
      logger.warn('[Tintim] Webhook secret não configurado');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Processa evento de webhook do Tintim
   * @param {Object} event - Evento recebido
   */
  async processWebhookEvent(event) {
    const { type, data, timestamp } = event;

    logger.info(`[Tintim] Evento recebido: ${type}`);

    try {
      switch (type) {
        case 'conversation.started':
          await this.handleConversationStarted(data);
          break;
        case 'lead.qualified':
          await this.handleLeadQualified(data);
          break;
        case 'lead.status_changed':
          await this.handleLeadStatusChanged(data);
          break;
        case 'sale.completed':
          await this.handleSaleCompleted(data);
          break;
        default:
          logger.info(`[Tintim] Evento não tratado: ${type}`);
      }

      // Salvar evento para auditoria
      await this.saveWebhookEvent(type, data, timestamp);

      return { success: true };
    } catch (error) {
      logger.error(`[Tintim] Erro ao processar evento ${type}:`, error.message);
      throw error;
    }
  }

  /**
   * Trata nova conversa iniciada
   */
  async handleConversationStarted(data) {
    const {
      conversation_id,
      phone,
      name,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      ad_id,
      adset_id,
      campaign_id,
      started_at
    } = data;

    logger.info(`[Tintim] Nova conversa: ${conversation_id} de ${phone}`);

    // Verificar se tabela existe antes de inserir
    try {
      await db.query(`
        INSERT INTO tintim_conversations (
          conversation_id, phone, name,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          meta_ad_id, meta_adset_id, meta_campaign_id,
          started_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (conversation_id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
      `, [
        conversation_id, phone, name,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        ad_id, adset_id, campaign_id,
        started_at
      ]);
    } catch (error) {
      // Se tabela não existe, apenas loga (migration não foi rodada ainda)
      if (error.code === '42P01') {
        logger.warn('[Tintim] Tabela tintim_conversations não existe. Execute a migration 004_tintim_integration.sql');
      } else {
        throw error;
      }
    }
  }

  /**
   * Trata lead qualificado
   */
  async handleLeadQualified(data) {
    const { conversation_id, phone, qualification, score, qualified_at } = data;

    logger.info(`[Tintim] Lead qualificado: ${phone} - ${qualification}`);

    try {
      await db.query(`
        UPDATE tintim_conversations
        SET qualification = $2, qualification_score = $3, qualified_at = $4, updated_at = NOW()
        WHERE conversation_id = $1
      `, [conversation_id, qualification, score, qualified_at]);
    } catch (error) {
      if (error.code !== '42P01') throw error;
    }
  }

  /**
   * Trata mudança de status do lead
   */
  async handleLeadStatusChanged(data) {
    const { conversation_id, phone, old_status, new_status, changed_at } = data;

    logger.info(`[Tintim] Status alterado: ${phone} ${old_status} -> ${new_status}`);

    try {
      await db.query(`
        UPDATE tintim_conversations
        SET status = $2, updated_at = NOW()
        WHERE conversation_id = $1
      `, [conversation_id, new_status]);

      // Salvar histórico de status
      await db.query(`
        INSERT INTO tintim_status_history (conversation_id, old_status, new_status, changed_at)
        VALUES ($1, $2, $3, $4)
      `, [conversation_id, old_status, new_status, changed_at]);
    } catch (error) {
      if (error.code !== '42P01') throw error;
    }
  }

  /**
   * Trata venda concluída
   */
  async handleSaleCompleted(data) {
    const {
      conversation_id,
      phone,
      sale_value,
      products,
      sold_at
    } = data;

    logger.info(`[Tintim] Venda concluída: ${phone} - R$ ${sale_value}`);

    try {
      await db.query(`
        UPDATE tintim_conversations
        SET
          sale_value = $2,
          sale_products = $3,
          sold_at = $4,
          status = 'sold',
          updated_at = NOW()
        WHERE conversation_id = $1
      `, [conversation_id, sale_value, JSON.stringify(products), sold_at]);

      // Atualizar métricas de ROI
      await this.updateROIMetrics(conversation_id);
    } catch (error) {
      if (error.code !== '42P01') throw error;
    }
  }

  /**
   * Atualiza métricas de ROI após uma venda
   */
  async updateROIMetrics(conversationId) {
    try {
      // Buscar dados da conversa
      const result = await db.query(`
        SELECT
          utm_source, utm_medium, utm_campaign,
          meta_campaign_id, meta_adset_id, meta_ad_id,
          sale_value
        FROM tintim_conversations
        WHERE conversation_id = $1
      `, [conversationId]);

      if (result.rows.length === 0) return;

      const conv = result.rows[0];

      // Atualizar métricas agregadas por campanha
      await db.query(`
        INSERT INTO marketing_roi_by_campaign (
          campaign_id, campaign_name, total_leads, converted_leads, total_revenue, last_updated
        ) VALUES ($1, $2, 1, 1, $3, NOW())
        ON CONFLICT (campaign_id) DO UPDATE SET
          converted_leads = marketing_roi_by_campaign.converted_leads + 1,
          total_revenue = marketing_roi_by_campaign.total_revenue + EXCLUDED.total_revenue,
          last_updated = NOW()
      `, [conv.meta_campaign_id, conv.utm_campaign, conv.sale_value]);

    } catch (error) {
      logger.error('[Tintim] Erro ao atualizar ROI:', error.message);
    }
  }

  /**
   * Salva evento para auditoria
   */
  async saveWebhookEvent(type, data, timestamp) {
    try {
      await db.query(`
        INSERT INTO tintim_webhook_events (event_type, event_data, event_timestamp, received_at)
        VALUES ($1, $2, $3, NOW())
      `, [type, JSON.stringify(data), timestamp]);
    } catch (error) {
      // Ignora erro se tabela não existe
      if (error.code !== '42P01') {
        logger.error('[Tintim] Erro ao salvar evento:', error.message);
      }
    }
  }

  /**
   * Obtém métricas de ROI por fonte (usando dados do Tintim)
   */
  async getROIBySource(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          COALESCE(utm_source, 'Direto') as source,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'sold' THEN 1 END) as converted_leads,
          COALESCE(SUM(sale_value), 0) as total_revenue,
          ROUND(
            COUNT(CASE WHEN status = 'sold' THEN 1 END)::numeric /
            NULLIF(COUNT(*), 0) * 100, 2
          ) as conversion_rate
        FROM tintim_conversations
        WHERE started_at BETWEEN $1 AND $2
        GROUP BY utm_source
        ORDER BY total_revenue DESC
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
  }

  /**
   * Obtém métricas de ROI por campanha
   */
  async getROIByCampaign(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          COALESCE(utm_campaign, 'Sem campanha') as campaign,
          utm_source as source,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'sold' THEN 1 END) as converted_leads,
          COALESCE(SUM(sale_value), 0) as total_revenue,
          ROUND(
            COUNT(CASE WHEN status = 'sold' THEN 1 END)::numeric /
            NULLIF(COUNT(*), 0) * 100, 2
          ) as conversion_rate
        FROM tintim_conversations
        WHERE started_at BETWEEN $1 AND $2
        GROUP BY utm_campaign, utm_source
        ORDER BY total_revenue DESC
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
  }

  /**
   * Obtém funil de conversão
   */
  async getConversionFunnel(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          status,
          COUNT(*) as count,
          ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER(), 0) * 100, 2) as percentage
        FROM tintim_conversations
        WHERE started_at BETWEEN $1 AND $2
        GROUP BY status
        ORDER BY
          CASE status
            WHEN 'new' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'qualified' THEN 3
            WHEN 'proposal' THEN 4
            WHEN 'negotiation' THEN 5
            WHEN 'sold' THEN 6
            WHEN 'lost' THEN 7
          END
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
  }
}

export default new TintimService();
