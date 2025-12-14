import db from '../database/index.js';
import logger from '../utils/logger.js';

/**
 * Serviço de Analytics de Clientes
 * Calcula métricas de lifetime value, segmentação RFM e análise de recorrência
 */
class CustomerAnalyticsService {

  /**
   * Calcula e atualiza as métricas de todos os clientes
   */
  async updateCustomerAnalytics() {
    const timer = Date.now();
    logger.info('[CustomerAnalytics] Iniciando atualização de métricas de clientes...');

    try {
      // Busca dados agregados de vendas por cliente
      const clientesResult = await db.query(`
        SELECT
          c.cod_cliente,
          c.nome,
          COUNT(v.id) as total_compras,
          COALESCE(SUM(v.valor_total), 0) as total_gasto,
          MIN(v.data_venda) as primeira_compra,
          MAX(v.data_venda) as ultima_compra,
          ROUND(COALESCE(AVG(v.valor_total), 0), 2) as ticket_medio
        FROM clientes c
        LEFT JOIN vendas v ON c.cod_cliente = v.cod_cliente
        GROUP BY c.cod_cliente, c.nome
        HAVING COUNT(v.id) > 0
      `);

      const clientes = clientesResult.rows;
      let updatedCount = 0;

      for (const cliente of clientes) {
        const diasComoCliente = cliente.primeira_compra && cliente.ultima_compra
          ? Math.floor((new Date(cliente.ultima_compra) - new Date(cliente.primeira_compra)) / (1000 * 60 * 60 * 24))
          : 0;

        const mesesComoCliente = Math.max(1, Math.ceil(diasComoCliente / 30));
        const frequenciaMensal = cliente.total_compras / mesesComoCliente;

        // RFM Scoring (simplificado)
        const now = new Date();
        const diasDesdeUltimaCompra = cliente.ultima_compra
          ? Math.floor((now - new Date(cliente.ultima_compra)) / (1000 * 60 * 60 * 24))
          : 999;

        // Recency Score (1-5, 5 = mais recente)
        let recencyScore = 1;
        if (diasDesdeUltimaCompra <= 30) recencyScore = 5;
        else if (diasDesdeUltimaCompra <= 60) recencyScore = 4;
        else if (diasDesdeUltimaCompra <= 90) recencyScore = 3;
        else if (diasDesdeUltimaCompra <= 180) recencyScore = 2;

        // Frequency Score (1-5, 5 = mais frequente)
        let frequencyScore = 1;
        if (cliente.total_compras >= 10) frequencyScore = 5;
        else if (cliente.total_compras >= 5) frequencyScore = 4;
        else if (cliente.total_compras >= 3) frequencyScore = 3;
        else if (cliente.total_compras >= 2) frequencyScore = 2;

        // Monetary Score (1-5, 5 = maior valor)
        let monetaryScore = 1;
        if (cliente.total_gasto >= 10000) monetaryScore = 5;
        else if (cliente.total_gasto >= 5000) monetaryScore = 4;
        else if (cliente.total_gasto >= 2000) monetaryScore = 3;
        else if (cliente.total_gasto >= 500) monetaryScore = 2;

        // Segmento RFM
        const rfmTotal = recencyScore + frequencyScore + monetaryScore;
        let rfmSegment = 'Low Value';
        if (rfmTotal >= 13) rfmSegment = 'Champions';
        else if (rfmTotal >= 10) rfmSegment = 'Loyal';
        else if (rfmTotal >= 7) rfmSegment = 'Potential';
        else if (rfmTotal >= 4) rfmSegment = 'At Risk';

        // Predicted LTV (simplificado: ticket médio * frequência mensal * 12 meses)
        const predictedLtv = cliente.ticket_medio * frequenciaMensal * 12;

        // Upsert
        await db.query(`
          INSERT INTO customer_analytics (
            cliente_id, cliente_nome,
            primeira_compra_at, ultima_compra_at,
            total_compras, total_gasto, ticket_medio,
            is_returning_customer, dias_como_cliente, frequencia_mensal,
            lifetime_value, predicted_ltv,
            rfm_recency_score, rfm_frequency_score, rfm_monetary_score, rfm_segment,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          ON CONFLICT (cliente_id) DO UPDATE SET
            cliente_nome = EXCLUDED.cliente_nome,
            primeira_compra_at = EXCLUDED.primeira_compra_at,
            ultima_compra_at = EXCLUDED.ultima_compra_at,
            total_compras = EXCLUDED.total_compras,
            total_gasto = EXCLUDED.total_gasto,
            ticket_medio = EXCLUDED.ticket_medio,
            is_returning_customer = EXCLUDED.is_returning_customer,
            dias_como_cliente = EXCLUDED.dias_como_cliente,
            frequencia_mensal = EXCLUDED.frequencia_mensal,
            lifetime_value = EXCLUDED.lifetime_value,
            predicted_ltv = EXCLUDED.predicted_ltv,
            rfm_recency_score = EXCLUDED.rfm_recency_score,
            rfm_frequency_score = EXCLUDED.rfm_frequency_score,
            rfm_monetary_score = EXCLUDED.rfm_monetary_score,
            rfm_segment = EXCLUDED.rfm_segment,
            updated_at = NOW()
        `, [
          cliente.cod_cliente,
          cliente.nome,
          cliente.primeira_compra,
          cliente.ultima_compra,
          cliente.total_compras,
          cliente.total_gasto,
          cliente.ticket_medio,
          cliente.total_compras > 1,
          diasComoCliente,
          frequenciaMensal,
          cliente.total_gasto, // LTV atual = total gasto
          predictedLtv,
          recencyScore,
          frequencyScore,
          monetaryScore,
          rfmSegment
        ]);

        updatedCount++;
      }

      const duration = Date.now() - timer;
      logger.info(`[CustomerAnalytics] Atualizados ${updatedCount} clientes em ${duration}ms`);

      return { success: true, updatedCount, duration };
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro ao atualizar métricas:', error.message);
      throw error;
    }
  }

  /**
   * Mapeia leads para clientes existentes
   */
  async mapLeadsToCustomers() {
    const timer = Date.now();
    logger.info('[CustomerAnalytics] Mapeando leads para clientes...');

    try {
      // Busca leads com telefone ou email
      const leadsResult = await db.query(`
        SELECT id, bitrix_id, telefones, emails
        FROM leads
        WHERE (telefones IS NOT NULL AND telefones != '[]')
           OR (emails IS NOT NULL AND emails != '[]')
      `);

      // Busca clientes com telefone
      const clientesResult = await db.query(`
        SELECT cod_cliente, telefone, celular, email
        FROM clientes
        WHERE telefone IS NOT NULL OR celular IS NOT NULL OR email IS NOT NULL
      `);

      const clientes = clientesResult.rows;
      let matchedCount = 0;

      for (const lead of leadsResult.rows) {
        const telefones = lead.telefones || [];
        const emails = lead.emails || [];

        // Normaliza telefones do lead
        const leadPhones = telefones
          .map(t => t.VALUE || t)
          .filter(Boolean)
          .map(p => p.replace(/\D/g, '').slice(-8)); // Últimos 8 dígitos

        // Normaliza emails do lead
        const leadEmails = emails
          .map(e => (e.VALUE || e || '').toLowerCase())
          .filter(Boolean);

        // Procura match nos clientes
        let matchedCliente = null;
        let matchedBy = null;
        let confidence = 0;

        for (const cliente of clientes) {
          // Match por telefone
          const clientePhones = [cliente.telefone, cliente.celular]
            .filter(Boolean)
            .map(p => p.replace(/\D/g, '').slice(-8));

          const phoneMatch = leadPhones.some(lp => clientePhones.includes(lp));
          if (phoneMatch) {
            matchedCliente = cliente;
            matchedBy = 'phone';
            confidence = 0.95;
            break;
          }

          // Match por email
          const clienteEmail = (cliente.email || '').toLowerCase();
          if (clienteEmail && leadEmails.includes(clienteEmail)) {
            matchedCliente = cliente;
            matchedBy = 'email';
            confidence = 0.90;
            break;
          }
        }

        if (matchedCliente) {
          // Verifica se é cliente recorrente
          const purchasesResult = await db.query(`
            SELECT COUNT(*) as count FROM vendas WHERE cod_cliente = $1
          `, [matchedCliente.cod_cliente]);

          const previousPurchases = parseInt(purchasesResult.rows[0].count) || 0;
          const isReturning = previousPurchases > 0;

          // Insere mapeamento
          await db.query(`
            INSERT INTO lead_customer_mapping (
              lead_id, bitrix_lead_id, cliente_id,
              matched_by, match_confidence,
              is_returning_customer, previous_purchases
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (lead_id) DO UPDATE SET
              cliente_id = EXCLUDED.cliente_id,
              matched_by = EXCLUDED.matched_by,
              match_confidence = EXCLUDED.match_confidence,
              is_returning_customer = EXCLUDED.is_returning_customer,
              previous_purchases = EXCLUDED.previous_purchases
          `, [
            lead.id,
            lead.bitrix_id,
            matchedCliente.cod_cliente,
            matchedBy,
            confidence,
            isReturning,
            previousPurchases
          ]);

          // Atualiza lead
          await db.query(`
            UPDATE leads SET
              is_returning_customer = $1,
              matched_cliente_id = $2
            WHERE id = $3
          `, [isReturning, matchedCliente.cod_cliente, lead.id]);

          matchedCount++;
        }
      }

      const duration = Date.now() - timer;
      logger.info(`[CustomerAnalytics] Mapeados ${matchedCount} leads em ${duration}ms`);

      return { success: true, matchedCount, duration };
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro ao mapear leads:', error.message);
      throw error;
    }
  }

  /**
   * Retorna estatísticas de clientes recorrentes
   */
  async getReturningCustomerStats(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN is_returning_customer THEN l.id END) as returning_leads,
          COUNT(DISTINCT CASE WHEN NOT is_returning_customer THEN l.id END) as new_leads,
          COUNT(DISTINCT l.id) as total_leads,
          ROUND(COUNT(DISTINCT CASE WHEN is_returning_customer THEN l.id END)::DECIMAL /
                NULLIF(COUNT(DISTINCT l.id), 0) * 100, 2) as returning_rate
        FROM leads l
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      return result.rows[0];
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro em getReturningCustomerStats:', error.message);
      return {
        returning_leads: 0,
        new_leads: 0,
        total_leads: 0,
        returning_rate: 0
      };
    }
  }

  /**
   * Retorna segmentação RFM agregada
   */
  async getRFMSegmentation() {
    try {
      const result = await db.query(`
        SELECT
          rfm_segment,
          COUNT(*) as count,
          ROUND(AVG(lifetime_value), 2) as avg_ltv,
          ROUND(AVG(total_compras), 1) as avg_purchases,
          ROUND(AVG(ticket_medio), 2) as avg_ticket
        FROM customer_analytics
        GROUP BY rfm_segment
        ORDER BY avg_ltv DESC
      `);

      return result.rows;
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro em getRFMSegmentation:', error.message);
      return [];
    }
  }

  /**
   * Retorna top clientes por LTV
   */
  async getTopCustomersByLTV(limit = 20) {
    try {
      const result = await db.query(`
        SELECT
          cliente_id,
          cliente_nome,
          total_compras,
          total_gasto,
          ticket_medio,
          dias_como_cliente,
          frequencia_mensal,
          lifetime_value,
          predicted_ltv,
          rfm_segment
        FROM customer_analytics
        ORDER BY lifetime_value DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro em getTopCustomersByLTV:', error.message);
      return [];
    }
  }

  /**
   * Retorna métricas de conversão agregadas
   */
  async getConversionMetrics(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(CASE WHEN ls.semantica = 'success' THEN 1 END) as converted,
          COUNT(CASE WHEN ls.semantica = 'failure' THEN 1 END) as disqualified,
          COUNT(CASE WHEN ls.semantica = 'process' OR ls.semantica IS NULL THEN 1 END) as in_progress,
          ROUND(COUNT(CASE WHEN ls.semantica = 'success' THEN 1 END)::DECIMAL /
                NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate,
          ROUND(AVG(CASE WHEN ls.semantica = 'success' AND l.bitrix_closed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (l.bitrix_closed_at - l.bitrix_created_at)) / 86400
            END), 1) as avg_conversion_days,
          ROUND(AVG(CASE WHEN ls.semantica = 'process' OR ls.semantica IS NULL
            THEN EXTRACT(EPOCH FROM (NOW() - l.bitrix_created_at)) / 86400
            END), 1) as avg_in_progress_days
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      return result.rows[0];
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro em getConversionMetrics:', error.message);
      return {
        total_leads: 0,
        converted: 0,
        disqualified: 0,
        in_progress: 0,
        conversion_rate: 0,
        avg_conversion_days: 0,
        avg_in_progress_days: 0
      };
    }
  }

  /**
   * Retorna funil de conversão com tempos por estágio
   */
  async getConversionFunnel(startDate, endDate) {
    try {
      // Busca distribuição por status com ordenação
      const result = await db.query(`
        SELECT
          ls.bitrix_status_id as status_id,
          ls.nome as status_name,
          ls.semantica,
          ls.sort_order,
          COUNT(l.id) as count,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (COALESCE(l.bitrix_closed_at, NOW()) - l.bitrix_created_at)) / 86400
          ), 1) as avg_days_in_stage
        FROM lead_statuses ls
        LEFT JOIN leads l ON l.status_id = ls.bitrix_status_id
          AND l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY ls.bitrix_status_id, ls.nome, ls.semantica, ls.sort_order
        ORDER BY ls.sort_order
      `, [startDate, endDate]);

      // Calcula percentuais do funil
      const total = result.rows.reduce((sum, row) => sum + parseInt(row.count || 0), 0);
      const funnel = result.rows.map((row, index) => {
        const count = parseInt(row.count || 0);
        return {
          stage: row.status_name,
          stageId: row.status_id,
          semantic: row.semantica,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
          avgDaysInStage: parseFloat(row.avg_days_in_stage) || 0,
          dropOffRate: index > 0
            ? Math.round((1 - count / Math.max(result.rows[index - 1].count || 1, 1)) * 100)
            : 0
        };
      });

      return funnel;
    } catch (error) {
      logger.error('[CustomerAnalytics] Erro em getConversionFunnel:', error.message);
      return [];
    }
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();
export default customerAnalyticsService;
