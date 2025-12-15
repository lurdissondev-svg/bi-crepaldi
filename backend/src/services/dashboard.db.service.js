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

        // Por UTM Source (formato compatível com bitrix24.service.js)
        const utmSource = lead.utm_source || 'direct';
        if (!byUtmSourceMap[utmSource]) {
          byUtmSourceMap[utmSource] = {
            source: utmSource,
            total: 0,
            converted: 0,
            disqualified: 0,
            inProgress: 0,
            campaigns: {},
          };
        }
        byUtmSourceMap[utmSource].total++;
        if (semantica === 'success') byUtmSourceMap[utmSource].converted++;
        else if (semantica === 'failure') byUtmSourceMap[utmSource].disqualified++;
        else byUtmSourceMap[utmSource].inProgress++;

        // Adiciona campaign ao source
        if (lead.utm_campaign) {
          if (!byUtmSourceMap[utmSource].campaigns[lead.utm_campaign]) {
            byUtmSourceMap[utmSource].campaigns[lead.utm_campaign] = {
              campaign: lead.utm_campaign,
              total: 0,
              converted: 0,
              disqualified: 0,
              inProgress: 0,
            };
          }
          byUtmSourceMap[utmSource].campaigns[lead.utm_campaign].total++;
          if (semantica === 'success') byUtmSourceMap[utmSource].campaigns[lead.utm_campaign].converted++;
          else if (semantica === 'failure') byUtmSourceMap[utmSource].campaigns[lead.utm_campaign].disqualified++;
          else byUtmSourceMap[utmSource].campaigns[lead.utm_campaign].inProgress++;
        }

        // Por UTM Medium (formato compatível com bitrix24.service.js)
        const utmMedium = lead.utm_medium || 'none';
        if (!byUtmMediumMap[utmMedium]) {
          byUtmMediumMap[utmMedium] = {
            medium: utmMedium,
            total: 0,
            converted: 0,
            disqualified: 0,
            inProgress: 0,
          };
        }
        byUtmMediumMap[utmMedium].total++;
        if (semantica === 'success') byUtmMediumMap[utmMedium].converted++;
        else if (semantica === 'failure') byUtmMediumMap[utmMedium].disqualified++;
        else byUtmMediumMap[utmMedium].inProgress++;

        // Por UTM Campaign (formato compatível com bitrix24.service.js)
        if (lead.utm_campaign) {
          const utmCampaign = lead.utm_campaign;
          if (!byUtmCampaignMap[utmCampaign]) {
            byUtmCampaignMap[utmCampaign] = {
              campaign: utmCampaign,
              total: 0,
              converted: 0,
              disqualified: 0,
              inProgress: 0,
              sources: {},
            };
          }
          byUtmCampaignMap[utmCampaign].total++;
          if (semantica === 'success') byUtmCampaignMap[utmCampaign].converted++;
          else if (semantica === 'failure') byUtmCampaignMap[utmCampaign].disqualified++;
          else byUtmCampaignMap[utmCampaign].inProgress++;

          // Adiciona source à campaign
          if (!byUtmCampaignMap[utmCampaign].sources[utmSource]) {
            byUtmCampaignMap[utmCampaign].sources[utmSource] = {
              source: utmSource,
              total: 0,
              converted: 0,
            };
          }
          byUtmCampaignMap[utmCampaign].sources[utmSource].total++;
          if (semantica === 'success') byUtmCampaignMap[utmCampaign].sources[utmSource].converted++;
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
      const byUtmSource = Object.values(byUtmSourceMap)
        .map(s => ({
          ...s,
          campaigns: Object.values(s.campaigns).sort((a, b) => b.total - a.total),
        }))
        .sort((a, b) => b.total - a.total);
      const byUtmMedium = Object.values(byUtmMediumMap).sort((a, b) => b.total - a.total);
      const byUtmCampaign = Object.values(byUtmCampaignMap)
        .map(c => ({
          ...c,
          sources: Object.values(c.sources).sort((a, b) => b.total - a.total),
        }))
        .sort((a, b) => b.total - a.total);
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
            cr.cod_cliente,
            cr.valor_liquido,
            cr.dt_lancamento,
            cr.cod_estab,
            ca.is_returning_customer,
            ca.primeira_compra_at
          FROM contas_receber cr
          LEFT JOIN customer_analytics ca ON cr.cod_cliente = ca.cliente_id
          WHERE cr.dt_lancamento >= $1 AND cr.dt_lancamento <= $2 AND cr.valor_liquido > 0
      `;

      const params = [startDate, endDate];

      if (centrosCusto.length > 0) {
        query += ` AND cr.cod_estab = ANY($3)`;
        params.push(centrosCusto.map(Number));
      }

      query += `
        ),
        revenue_by_type AS (
          SELECT
            -- Paciente novo: primeira compra no período OU não tem histórico anterior
            SUM(CASE
              WHEN primeira_compra_at IS NULL THEN valor_liquido
              WHEN primeira_compra_at >= $1::date THEN valor_liquido
              ELSE 0
            END) AS new_patient_revenue,
            -- Paciente recorrente: já tinha compras antes do período
            SUM(CASE
              WHEN primeira_compra_at IS NOT NULL AND primeira_compra_at < $1::date THEN valor_liquido
              ELSE 0
            END) AS returning_patient_revenue,
            SUM(valor_liquido) AS total_revenue,
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

  // ==================== FATURAMENTO DO BANCO ====================

  /**
   * Busca faturamento do banco de dados (contas_receber)
   * Prioriza dados do banco quando disponíveis
   */
  async getFaturamentoFromDB(startDate, endDate, estabelecimentosFiltro = []) {
    try {
      let query = `
        SELECT
          cod_estab,
          SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) as faturamento_total,
          SUM(CASE WHEN confirmado = 'S' THEN valor_liquido ELSE 0 END) as faturamento_liquido,
          COUNT(CASE WHEN confirmado = 'S' THEN 1 END) as quantidade_movimentos
        FROM contas_receber
        WHERE dt_lancamento >= $1 AND dt_lancamento <= $2
      `;

      const params = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(estabelecimentosFiltro);
      }

      query += ` GROUP BY cod_estab`;

      const result = await db.query(query, params);

      let faturamentoTotal = 0;
      let quantidadeMovimentos = 0;
      const faturamentoPorEstabelecimento = {};

      for (const row of result.rows) {
        const valor = parseFloat(row.faturamento_total) || 0;
        faturamentoTotal += valor;
        quantidadeMovimentos += parseInt(row.quantidade_movimentos) || 0;
        faturamentoPorEstabelecimento[row.cod_estab] = {
          codestab: row.cod_estab,
          valor,
          quantidade: parseInt(row.quantidade_movimentos) || 0,
        };
      }

      const ticketMedio = quantidadeMovimentos > 0 ? faturamentoTotal / quantidadeMovimentos : 0;

      return {
        faturamentoTotal,
        quantidadeMovimentos,
        ticketMedio,
        porEstabelecimento: Object.values(faturamentoPorEstabelecimento),
        source: 'database',
      };
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoFromDB:', error.message);
      return null;
    }
  }

  /**
   * Verifica se há dados suficientes no banco para um período
   * Retorna true se o banco tem cobertura completa do período
   */
  async hasDataForPeriod(startDate, endDate, tableName = 'contas_receber') {
    try {
      const query = `
        SELECT
          MIN(dt_lancamento)::date as min_date,
          MAX(dt_lancamento)::date as max_date,
          COUNT(*) as total_records
        FROM ${tableName}
        WHERE dt_lancamento >= $1 AND dt_lancamento <= $2
      `;

      const result = await db.query(query, [startDate, endDate]);
      const row = result.rows[0];

      if (!row || row.total_records === 0) {
        return { hasData: false, coverage: 0 };
      }

      // Calcula cobertura aproximada
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      const minTime = new Date(row.min_date).getTime();
      const maxTime = new Date(row.max_date).getTime();

      const periodDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
      const coveredDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
      const coverage = periodDays > 0 ? Math.min(100, (coveredDays / periodDays) * 100) : 0;

      return {
        hasData: row.total_records > 0,
        coverage: Math.round(coverage),
        records: parseInt(row.total_records),
        minDate: row.min_date,
        maxDate: row.max_date,
      };
    } catch (error) {
      logger.error('[DB] Erro em hasDataForPeriod:', error.message);
      return { hasData: false, coverage: 0 };
    }
  }

  /**
   * Busca faturamento diário agregado do banco
   */
  async getFaturamentoDiarioFromDB(startDate, endDate, estabelecimentosFiltro = []) {
    try {
      let query = `
        SELECT
          data_referencia,
          cod_estab,
          faturamento_bruto,
          faturamento_liquido,
          quantidade_movimentos
        FROM faturamento_diario
        WHERE data_referencia >= $1 AND data_referencia <= $2
      `;

      const params = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(estabelecimentosFiltro);
      }

      query += ` ORDER BY data_referencia`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoDiarioFromDB:', error.message);
      return [];
    }
  }

  /**
   * Busca estatísticas gerais do banco para o período
   */
  async getDBStats() {
    try {
      const query = `
        SELECT
          'contas_receber' as tabela,
          COUNT(*) as total,
          MIN(dt_lancamento)::date as min_date,
          MAX(dt_lancamento)::date as max_date
        FROM contas_receber
        UNION ALL
        SELECT
          'vendas' as tabela,
          COUNT(*) as total,
          MIN(data_venda)::date as min_date,
          MAX(data_venda)::date as max_date
        FROM vendas
        UNION ALL
        SELECT
          'faturamento_diario' as tabela,
          COUNT(*) as total,
          MIN(data_referencia) as min_date,
          MAX(data_referencia) as max_date
        FROM faturamento_diario
      `;

      const result = await db.query(query);
      return result.rows.reduce((acc, row) => {
        acc[row.tabela] = {
          total: parseInt(row.total),
          minDate: row.min_date,
          maxDate: row.max_date,
        };
        return acc;
      }, {});
    } catch (error) {
      logger.error('[DB] Erro em getDBStats:', error.message);
      return {};
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
