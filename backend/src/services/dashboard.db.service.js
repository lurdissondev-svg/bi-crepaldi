import db from '../database/index.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';

/**
 * Serviço de Dashboard que busca dados do PostgreSQL
 * Muito mais rápido que chamar APIs externas
 */
class DashboardDBService {

  // ==================== MARKETING / LEADS ====================

  /**
   * Busca analytics de leads do banco de dados
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async getLeadsAnalytics(startDate, endDate) {
    const timer = Date.now();

    try {
      // Busca leads do período
      const leadsResult = await db.query(`
        SELECT
          l.id,
          l.bitrix_id,
          l.titulo,
          l.nome,
          l.sobrenome,
          l.status_id,
          l.source_id,
          l.utm_source,
          l.utm_medium,
          l.utm_campaign,
          l.opportunity,
          l.bitrix_created_at,
          l.bitrix_modified_at,
          l.bitrix_closed_at,
          l.custom_fields,
          ls.nome as status_nome,
          ls.semantica as status_semantica,
          lso.nome as source_nome
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        LEFT JOIN lead_sources lso ON l.source_id = lso.bitrix_source_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        ORDER BY l.bitrix_created_at DESC
      `, [startDate, endDate]);

      const leads = leadsResult.rows;

      // Categorizar leads
      const categorized = {
        new: 0,
        inProgress: 0,
        converted: 0,
        disqualified: 0,
      };

      // Por hora
      const byHour = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));

      // Por origem do lead (UF_CRM_1692640693814)
      const byOrigemLeadMap = {};

      // Por UTM Source
      const byUtmSourceMap = {};

      // Por UTM Medium
      const byUtmMediumMap = {};

      // Por UTM Campaign
      const byUtmCampaignMap = {};

      // Por status
      const statusDistributionMap = {};

      // Heatmap (dia x hora)
      const heatmapMap = {};

      leads.forEach(lead => {
        // Categorização por semântica (banco usa success/failure/process/apology)
        const semantica = lead.status_semantica || 'process';
        if (lead.status_id === 'NEW') {
          categorized.new++;
        } else if (semantica === 'success') {
          categorized.converted++;
        } else if (semantica === 'failure') {
          categorized.disqualified++;
        } else {
          categorized.inProgress++;
        }

        // Por hora
        if (lead.bitrix_created_at) {
          const hour = new Date(lead.bitrix_created_at).getHours();
          byHour[hour].count++;

          // Heatmap
          const dayOfWeek = new Date(lead.bitrix_created_at).getDay();
          const key = `${dayOfWeek}-${hour}`;
          heatmapMap[key] = (heatmapMap[key] || 0) + 1;
        }

        // Por Origem do Lead (custom field)
        const customFields = lead.custom_fields || {};
        const origemId = customFields.UF_CRM_1692640693814 || 'NAO_PREENCHIDO';
        if (!byOrigemLeadMap[origemId]) {
          byOrigemLeadMap[origemId] = {
            id: origemId,
            name: this.getOrigemLeadName(origemId),
            total: 0,
            inProgress: 0,
            converted: 0,
            disqualified: 0,
          };
        }
        byOrigemLeadMap[origemId].total++;
        if (semantica === 'success') byOrigemLeadMap[origemId].converted++;
        else if (semantica === 'failure') byOrigemLeadMap[origemId].disqualified++;
        else byOrigemLeadMap[origemId].inProgress++;

        // Por UTM Source
        const utmSource = lead.utm_source || 'direct';
        if (!byUtmSourceMap[utmSource]) {
          byUtmSourceMap[utmSource] = { name: utmSource, count: 0, converted: 0 };
        }
        byUtmSourceMap[utmSource].count++;
        if (semantica === 'success') byUtmSourceMap[utmSource].converted++;

        // Por UTM Medium
        const utmMedium = lead.utm_medium || 'none';
        if (!byUtmMediumMap[utmMedium]) {
          byUtmMediumMap[utmMedium] = { name: utmMedium, count: 0, converted: 0 };
        }
        byUtmMediumMap[utmMedium].count++;
        if (semantica === 'success') byUtmMediumMap[utmMedium].converted++;

        // Por UTM Campaign
        if (lead.utm_campaign) {
          const utmCampaign = lead.utm_campaign;
          if (!byUtmCampaignMap[utmCampaign]) {
            byUtmCampaignMap[utmCampaign] = { name: utmCampaign, count: 0, converted: 0 };
          }
          byUtmCampaignMap[utmCampaign].count++;
          if (semantica === 'success') byUtmCampaignMap[utmCampaign].converted++;
        }

        // Por status
        const statusName = lead.status_nome || lead.status_id || 'Desconhecido';
        if (!statusDistributionMap[statusName]) {
          statusDistributionMap[statusName] = {
            status: statusName,
            count: 0,
            semantica: lead.status_semantica
          };
        }
        statusDistributionMap[statusName].count++;
      });

      // Converter maps para arrays
      const byOrigemLead = Object.values(byOrigemLeadMap).sort((a, b) => b.total - a.total);
      const byUtmSource = Object.values(byUtmSourceMap).sort((a, b) => b.count - a.count);
      const byUtmMedium = Object.values(byUtmMediumMap).sort((a, b) => b.count - a.count);
      const byUtmCampaign = Object.values(byUtmCampaignMap).sort((a, b) => b.count - a.count);
      const statusDistribution = Object.values(statusDistributionMap).sort((a, b) => b.count - a.count);

      // Heatmap
      const heatmap = Object.entries(heatmapMap).map(([key, count]) => {
        const [day, hour] = key.split('-').map(Number);
        return { day, hour, count };
      });

      // Métricas
      const conversionRate = leads.length > 0
        ? (categorized.converted / leads.length) * 100
        : 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] getLeadsAnalytics: ${leads.length} leads em ${duration}ms`);

      return {
        total: leads.length,
        categorized,
        byHour,
        byOrigemLead,
        byUtmSource,
        byUtmMedium,
        byUtmCampaign,
        statusDistribution,
        heatmap,
        conversionRate,
        rawLeads: leads, // Para compatibilidade
        metrics: {
          avgConversionDays: 0, // TODO: calcular
          avgInProgressDays: 0,
          totalConverted: categorized.converted,
          totalDisqualified: categorized.disqualified,
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getLeadsAnalytics:', error.message);
      throw error;
    }
  }

  /**
   * Busca leads diários agregados (já calculados pelo sync)
   */
  async getLeadsDiario(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          data_referencia,
          total_leads,
          leads_novos,
          leads_em_andamento,
          leads_convertidos,
          leads_perdidos,
          por_fonte,
          por_utm_source,
          por_hora
        FROM leads_diario
        WHERE data_referencia >= $1 AND data_referencia <= $2
        ORDER BY data_referencia
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      logger.error('[DB] Erro em getLeadsDiario:', error.message);
      return [];
    }
  }

  // ==================== FATURAMENTO ====================

  /**
   * Busca faturamento diário agregado (se disponível no banco)
   */
  async getFaturamentoDiario(startDate, endDate, centrosCusto = []) {
    try {
      let query = `
        SELECT
          data_referencia,
          cod_estab,
          valor_total,
          quantidade_movimentos,
          ticket_medio,
          por_forma_pagamento
        FROM faturamento_diario
        WHERE data_referencia >= $1 AND data_referencia <= $2
      `;
      const params = [startDate, endDate];

      if (centrosCusto.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(centrosCusto.map(Number));
      }

      query += ` ORDER BY data_referencia`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoDiario:', error.message);
      return [];
    }
  }

  /**
   * Busca contas a receber do banco
   */
  async getContasReceber(startDate, endDate, centrosCusto = []) {
    try {
      let query = `
        SELECT
          cod_conta,
          cod_estab,
          cod_cliente,
          valor_bruto,
          valor_liquido,
          nome_forma_pagamento,
          dt_lancamento,
          confirmado
        FROM contas_receber
        WHERE dt_lancamento >= $1 AND dt_lancamento <= $2
          AND confirmado = 'S'
      `;
      const params = [startDate, endDate];

      if (centrosCusto.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(centrosCusto.map(Number));
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('[DB] Erro em getContasReceber:', error.message);
      return [];
    }
  }

  // ==================== HELPERS ====================

  /**
   * Verifica se há dados no banco para um período
   */
  async hasDataForPeriod(table, dateColumn, startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM ${table}
        WHERE ${dateColumn} >= $1 AND ${dateColumn} <= $2
        LIMIT 1
      `, [startDate, endDate]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the last sync info from the database
   * Used as fallback when in-memory state is empty
   */
  async getLastSyncInfo() {
    const query = `
      SELECT
        MAX(CASE WHEN status IN ('success', 'partial', 'error') THEN finished_at END) as last_sync_at,
        (SELECT status FROM sync_logs WHERE status IN ('success', 'partial', 'error') ORDER BY finished_at DESC LIMIT 1) as last_sync_status,
        EXISTS(SELECT 1 FROM sync_logs WHERE status = 'running') as has_running_syncs
      FROM sync_logs
      WHERE started_at >= NOW() - INTERVAL '1 day'
    `;

    const result = await db.query(query);
    const row = result.rows[0];

    if (!row || !row.last_sync_at) {
      return null;
    }

    return {
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      hasRunningSyncs: row.has_running_syncs,
    };
  }

  // ==================== CUSTOMER ANALYTICS ====================

  /**
   * Calcula a porcentagem de faturamento de pacientes novos vs recorrentes
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {string[]} centrosCusto - Filtro de centros de custo (opcional)
   * @returns {Object} { newPatientPercentage, returningPatientPercentage, newRevenue, returningRevenue, totalRevenue }
   */
  async getNewPatientRevenuePercentage(startDate, endDate, centrosCusto = []) {
    try {
      // Query que calcula faturamento separado por pacientes novos vs recorrentes
      // usando a tabela customer_analytics criada na Fase 2
      let query = `
        WITH period_sales AS (
          SELECT
            v.cod_cliente,
            v.valor_total,
            v.data_venda,
            v.cod_estab,
            ca.is_returning_customer,
            ca.primeira_compra_at
          FROM vendas v
          LEFT JOIN customer_analytics ca ON v.cod_cliente = ca.cliente_id
          WHERE v.data_venda >= $1 AND v.data_venda <= $2
      `;

      const params = [startDate, endDate];

      if (centrosCusto.length > 0) {
        query += ` AND v.cod_estab = ANY($3)`;
        params.push(centrosCusto.map(Number));
      }

      query += `
        ),
        revenue_by_type AS (
          SELECT
            -- Paciente novo: primeira compra no período OU não tem histórico anterior
            SUM(CASE
              WHEN primeira_compra_at IS NULL THEN valor_total
              WHEN primeira_compra_at >= $1::date THEN valor_total
              ELSE 0
            END) AS new_patient_revenue,
            -- Paciente recorrente: já tinha compras antes do período
            SUM(CASE
              WHEN primeira_compra_at IS NOT NULL AND primeira_compra_at < $1::date THEN valor_total
              ELSE 0
            END) AS returning_patient_revenue,
            SUM(valor_total) AS total_revenue,
            COUNT(DISTINCT CASE
              WHEN primeira_compra_at IS NULL OR primeira_compra_at >= $1::date THEN cod_cliente
            END) AS new_patient_count,
            COUNT(DISTINCT CASE
              WHEN primeira_compra_at IS NOT NULL AND primeira_compra_at < $1::date THEN cod_cliente
            END) AS returning_patient_count
          FROM period_sales
        )
        SELECT
          COALESCE(new_patient_revenue, 0) AS new_revenue,
          COALESCE(returning_patient_revenue, 0) AS returning_revenue,
          COALESCE(total_revenue, 0) AS total_revenue,
          CASE
            WHEN COALESCE(total_revenue, 0) > 0
            THEN ROUND((COALESCE(new_patient_revenue, 0) / total_revenue * 100)::numeric, 1)
            ELSE 0
          END AS new_patient_percentage,
          CASE
            WHEN COALESCE(total_revenue, 0) > 0
            THEN ROUND((COALESCE(returning_patient_revenue, 0) / total_revenue * 100)::numeric, 1)
            ELSE 0
          END AS returning_patient_percentage,
          COALESCE(new_patient_count, 0) AS new_patient_count,
          COALESCE(returning_patient_count, 0) AS returning_patient_count
        FROM revenue_by_type
      `;

      const result = await db.query(query, params);
      const row = result.rows[0] || {};

      logger.debug(`[DB] getNewPatientRevenuePercentage: novo=${row.new_patient_percentage}%, recorrente=${row.returning_patient_percentage}%`);

      return {
        newPatientPercentage: parseFloat(row.new_patient_percentage) || 0,
        returningPatientPercentage: parseFloat(row.returning_patient_percentage) || 0,
        newRevenue: parseFloat(row.new_revenue) || 0,
        returningRevenue: parseFloat(row.returning_revenue) || 0,
        totalRevenue: parseFloat(row.total_revenue) || 0,
        newPatientCount: parseInt(row.new_patient_count) || 0,
        returningPatientCount: parseInt(row.returning_patient_count) || 0,
      };
    } catch (error) {
      logger.error('[DB] Erro em getNewPatientRevenuePercentage:', error.message);
      // Fallback para estimativas se a query falhar (tabela não existe ainda)
      return {
        newPatientPercentage: 35,
        returningPatientPercentage: 65,
        newRevenue: 0,
        returningRevenue: 0,
        totalRevenue: 0,
        newPatientCount: 0,
        returningPatientCount: 0,
        isEstimate: true,
      };
    }
  }

  /**
   * Mapeia ID de origem do lead para nome
   */
  getOrigemLeadName(origemId) {
    const ORIGEM_LEAD_MAP = {
      '2138': 'Facebook Ads',
      '136': 'Google Ads',
      '200': 'Site',
      '610': 'Campanha',
      '208': 'Indicação',
      '3674': 'Instagram - Perfil Dra Kelly',
      '3566': 'Instagram - Perfil Dra Natasha',
      '3568': 'Instagram - Perfil Grupo Crepaldi',
      '3570': 'Instagram - Perfil SPA',
      '3572': 'Instagram - Perfil Convenios',
      '3574': 'Instagram - Perfil Bela Laser',
      '1788': 'Instagram Post',
      '1790': 'Iniciativa do paciente',
      '3612': 'Iniciativa Interna',
      '7306': 'Agendamento Presencial',
      '1016': 'Orgânico',
      '7370': 'Remarketing SPA',
      '7380': 'Remarketing Clinica Crepaldi',
      '7382': 'SPA',
      '634': 'Não identificado',
      '7400': 'Grupo OFF estetica',
      '7746': 'Instagram - Perfil Dr. Paulo',
      '8192': 'Agendamento por Ligação',
      '8484': 'Parceria',
      'NAO_PREENCHIDO': 'Não preenchido',
    };
    return ORIGEM_LEAD_MAP[String(origemId)] || 'Não identificado';
  }
}

export const dashboardDBService = new DashboardDBService();
export default dashboardDBService;
