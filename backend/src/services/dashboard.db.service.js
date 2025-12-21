import db from '../database/index.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import belleService from './belle.service.js';

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

      // Por motivo de desqualificação (UF_CRM_1695041103)
      const byMotivoDesqualificacaoMap = {};

      // Lista de leads desqualificados para calcular métricas
      const disqualifiedLeads = [];

      leads.forEach(lead => {
        // Categorização por semântica (banco usa success/failure/process/apology)
        const semantica = lead.status_semantica || 'process';
        if (lead.status_id === 'NEW') {
          categorized.new++;
        } else if (semantica === 'success') {
          categorized.converted++;
        } else if (semantica === 'failure') {
          categorized.disqualified++;
          // Registrar motivo de desqualificação
          const customFields = lead.custom_fields || {};
          const motivoId = customFields.UF_CRM_1695041103 || 'NAO_PREENCHIDO';
          if (!byMotivoDesqualificacaoMap[motivoId]) {
            byMotivoDesqualificacaoMap[motivoId] = {
              id: motivoId,
              name: this.getMotivoDesqualificacaoName(motivoId),
              count: 0,
            };
          }
          byMotivoDesqualificacaoMap[motivoId].count++;
          disqualifiedLeads.push(lead);
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

      // Por Campanha Bitrix (campo UF_CRM_1729176132205)
      // Campos renomeados para clareza:
      // - agendados: leads com status CONVERTED (virou agendamento)
      // - convertidos: será preenchido depois com deals WON
      // - desqualificados: leads com status JUNK/failure
      // - emAndamento: leads ainda em processo
      const byCampanhaBitrixMap = {};
      leads.forEach(lead => {
        const customFields = lead.custom_fields || {};
        const campanhaId = customFields.UF_CRM_1729176132205 || 'NAO_PREENCHIDO';
        const campanhaName = this.getCampanhaName(campanhaId === 'NAO_PREENCHIDO' ? null : campanhaId);
        const semantica = lead.status_semantica || 'process';
        const statusId = lead.status_id;

        if (!byCampanhaBitrixMap[campanhaId]) {
          byCampanhaBitrixMap[campanhaId] = {
            id: campanhaId,
            name: campanhaName,
            total: 0,
            agendados: 0,      // Lead CONVERTED (virou agendamento)
            convertidos: 0,    // Deal WON (será preenchido via API)
            desqualificados: 0,
            emAndamento: 0,
            value: 0,
          };
        }

        byCampanhaBitrixMap[campanhaId].total++;
        byCampanhaBitrixMap[campanhaId].value += parseFloat(lead.opportunity) || 0;

        // Agendados = status CONVERTED (virou agendamento)
        if (statusId === 'CONVERTED' || semantica === 'success') {
          byCampanhaBitrixMap[campanhaId].agendados++;
        } else if (statusId === 'JUNK' || semantica === 'failure') {
          byCampanhaBitrixMap[campanhaId].desqualificados++;
        } else {
          byCampanhaBitrixMap[campanhaId].emAndamento++;
        }
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
      const byCampanhaBitrix = Object.values(byCampanhaBitrixMap).sort((a, b) => b.total - a.total);
      const statusDistribution = Object.values(statusDistributionMap).sort((a, b) => b.count - a.count);
      const byMotivoDesqualificacao = Object.values(byMotivoDesqualificacaoMap).sort((a, b) => b.count - a.count);

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

      // Mapa de origens
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

      // Mapa de campanhas Bitrix
      const CAMPANHA_MAP = {
        '7358': 'Não veio por campanha',
        '3720': 'Depilação a Laser',
        '3722': 'Ultraforme',
        '3724': 'Quizena do Botox',
        '3726': 'Vem verão Crepaldi',
        '3728': 'Salamê Minguê Crepaldi',
        '3730': 'You Inside The Box',
        '7264': 'Plano Anual de Botox',
        '7266': 'Blefaroplastia',
        '7328': 'Day spa',
        '7300': 'Day Spa de Aniversario',
        '7316': 'Soft Lift',
        '7322': 'Limpeza de Pele',
        '7334': 'Elas no Campo',
        '7340': 'Volnewmer',
        '7346': 'Ultraforme III',
        '7352': 'Power Shape',
        '7364': 'Heccus',
        '7410': 'Fotona',
        '7416': 'Massagem Cranio Facial',
        '7418': 'Massagem com Pindas',
        '7420': 'Massagem Relaxante',
        '7466': 'Ventosa',
        '7422': 'Botox',
        '7424': 'Geral',
        '7472': 'Melasma',
        '7478': 'Zfield',
        '7688': 'Face Skin Koreano',
        '7700': 'Drenagem',
        '7702': 'Post Direcionando ao Whats',
        '7712': 'Pure Skin Ritual',
        '7718': 'Chikungunya',
        '7734': 'Avaliação Gratuita',
        '7736': 'Miofascial',
        '7756': 'Procedimento - Dr Paulo',
        '7758': 'Consulta - Dr Paulo',
        '7768': 'Protocolo Alto em Colageno',
        '7770': 'Protocolo Alto em Rejuvenescimento',
        '7772': 'Protocolo Alto em Firmeza',
        '7786': 'Protocolo Dia das Mães',
        '7788': 'Remoção de Tatuagem',
        '7790': 'Remarketing Blefaro',
        '7792': 'Venquish',
        '8026': 'Dia dos Namorados',
        '8202': 'Acido Hialuronico',
        '8204': 'Radiesse',
        '8206': 'Tratamento Orelha Rasgada',
        '8208': 'Rinomodelacao',
        '8286': 'Suspensão Elastica - Cuiabá + Raio',
        '8292': 'Suspensão Elastica - Cuiabá + Profissões',
        '8294': 'Suspensão Elastica - Outras Cidades',
        '8332': 'Avaliação Gratuita - Lipedema',
        '8348': 'Naturalidade',
        '8472': 'Ultraformer Face Pescoço - Black Friday',
        '8494': 'DEVILLE HOTEIS E TURISMO LTDA.',
        '8500': 'Depilação - Black Friday',
        '8524': 'Cartão Presente',
        'NAO_PREENCHIDO': 'Não preenchido',
      };

      // Mapa de motivos de desqualificação
      const MOTIVO_DESQUALIFICACAO_MAP = {
        '348': 'Reação de Instagram',
        '350': 'Conversa não respondida',
        '352': 'Conversa não respondida após várias tentativas',
        '354': 'Preço',
        '618': 'Informações Adicionais',
        '626': 'Marketing/Propaganda/Vendedor',
        '810': 'Não compareceu',
        '1522': 'Não é de Cuiabá',
        '1524': 'Está em Viagem',
        '7056': 'Solicitou Contato Futuro',
        '7058': 'Problemas financeiros',
        '7060': 'Não Possui Interesse no Momento',
        '7062': 'Agendou para outro paciente',
        '7064': 'Telefone Incorreto',
        '7066': 'Outras Prioridades no momento',
        '7226': 'Envio de Pós pela Enfermagem',
        '7254': 'Venda de Voucher',
        '7446': 'Conversa finalizada e não movimentada',
        '7456': 'Contato será retomado após o recesso',
        '7724': 'Envio da Pesquisa de Satisfação',
        'NAO_PREENCHIDO': 'Não preenchido',
      };

      return {
        total: leads.length,
        categorized,
        byHour,
        byOrigemLead,
        byUtmSource,
        byUtmMedium,
        byUtmCampaign,
        byCampanhaBitrix,
        byMotivoDesqualificacao,
        statusDistribution,
        heatmap,
        conversionRate,
        rawLeads: leads, // Para compatibilidade
        origemLeadMap: ORIGEM_LEAD_MAP, // Para análise cruzada no frontend
        campanhaMap: CAMPANHA_MAP, // Mapa de campanhas Bitrix
        motivoDesqualificacaoMap: MOTIVO_DESQUALIFICACAO_MAP, // Mapa de motivos de desqualificação
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
      // Lógica: para cada transação, verifica se o cliente já tinha comprado ANTES dessa transação
      // - NOVO: a transação é a primeira compra do cliente (dt_lancamento próximo de primeira_compra_at)
      // - RECORRENTE: o cliente já tinha comprado antes dessa transação
      let query = `
        WITH period_sales AS (
          SELECT
            cr.cod_cliente,
            cr.valor_liquido,
            cr.dt_lancamento,
            cr.cod_estab,
            ca.primeira_compra_at,
            -- Transação é "nova" se é a primeira compra do cliente (margem de 7 dias)
            CASE
              WHEN ca.primeira_compra_at IS NULL THEN true
              WHEN cr.dt_lancamento::date <= (ca.primeira_compra_at::date + INTERVAL '7 days') THEN true
              ELSE false
            END AS is_first_purchase
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
            -- Faturamento de transações de primeira compra
            SUM(CASE WHEN is_first_purchase THEN valor_liquido ELSE 0 END) AS new_patient_revenue,
            -- Faturamento de transações de clientes recorrentes
            SUM(CASE WHEN NOT is_first_purchase THEN valor_liquido ELSE 0 END) AS returning_patient_revenue,
            SUM(valor_liquido) AS total_revenue,
            COUNT(DISTINCT CASE WHEN is_first_purchase THEN cod_cliente END) AS new_patient_count,
            COUNT(DISTINCT CASE WHEN NOT is_first_purchase THEN cod_cliente END) AS returning_patient_count
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
          cr.cod_estab,
          COALESCE(e.nome, 'Estabelecimento ' || cr.cod_estab) as nome_estabelecimento,
          SUM(CASE WHEN cr.confirmado = 'S' THEN cr.valor_bruto ELSE 0 END) as faturamento_total,
          SUM(CASE WHEN cr.confirmado = 'S' THEN cr.valor_liquido ELSE 0 END) as faturamento_liquido,
          COUNT(CASE WHEN cr.confirmado = 'S' THEN 1 END) as quantidade_movimentos
        FROM contas_receber cr
        LEFT JOIN estabelecimentos e ON cr.cod_estab = e.cod_estab
        WHERE cr.dt_lancamento >= $1 AND cr.dt_lancamento <= $2
      `;

      const params = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        query += ` AND cr.cod_estab = ANY($3)`;
        params.push(estabelecimentosFiltro);
      }

      query += ` GROUP BY cr.cod_estab, e.nome`;

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
          estabelecimento: row.nome_estabelecimento,
          nome: row.nome_estabelecimento,
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
   * Busca faturamento mensal agregado do banco (histórico por mês)
   */
  async getFaturamentoMensalFromDB(startDate, endDate, estabelecimentosFiltro = []) {
    try {
      let query = `
        SELECT
          TO_CHAR(dt_lancamento, 'YYYY-MM') as mes,
          TO_CHAR(dt_lancamento, 'Mon/YY') as mes_formatado,
          SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) as valor
        FROM contas_receber
        WHERE dt_lancamento >= $1 AND dt_lancamento <= $2
      `;

      const params = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(estabelecimentosFiltro);
      }

      query += ` GROUP BY TO_CHAR(dt_lancamento, 'YYYY-MM'), TO_CHAR(dt_lancamento, 'Mon/YY')
                 ORDER BY mes`;

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        mes: row.mes_formatado,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoMensalFromDB:', error.message);
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

  // ==================== PACIENTES DO BANCO ====================

  /**
   * Busca analytics de pacientes do banco de dados (contas_receber)
   * Usa raw_data->>'nome_cliente' para obter o nome real
   */
  async getPacientesAnalyticsFromDB(startDate, endDate, estabelecimentosFiltro = []) {
    try {
      const timer = Date.now();

      // 1. Query para buscar faturamento por cliente NO PERÍODO SELECIONADO
      let faturamentoQuery = `
        WITH cliente_stats AS (
          SELECT
            cod_cliente,
            raw_data->>'nome_cliente' as nome_cliente,
            COUNT(*) as quantidade_vendas,
            SUM(valor_liquido) as investimento,
            MAX(dt_lancamento) as ultima_compra
          FROM contas_receber
          WHERE dt_lancamento >= $1::date
            AND dt_lancamento <= $2::date
            AND confirmado = 'S'
            AND valor_liquido > 0
      `;

      const faturamentoParams = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        faturamentoQuery += ` AND cod_estab = ANY($3)`;
        faturamentoParams.push(estabelecimentosFiltro);
      }

      faturamentoQuery += `
          GROUP BY cod_cliente, raw_data->>'nome_cliente'
        )
        SELECT
          cod_cliente,
          COALESCE(nome_cliente, 'Cliente ' || cod_cliente) as cliente,
          quantidade_vendas as "quantidadeVendas",
          ROUND(investimento::numeric, 2) as investimento,
          ultima_compra
        FROM cliente_stats
        WHERE nome_cliente IS NOT NULL AND nome_cliente != ''
        ORDER BY investimento DESC
      `;

      const faturamentoResult = await db.query(faturamentoQuery, faturamentoParams);
      const faturamentoPaciente = faturamentoResult.rows.map(row => ({
        cliente: row.cliente,
        clienteId: row.cod_cliente,
        quantidadeVendas: parseInt(row.quantidadeVendas) || 0,
        investimento: parseFloat(row.investimento) || 0,
      }));

      // 2. Query para buscar POTENCIAIS +4 meses (mais de 120 dias sem comprar)
      // Ordenados por investimento (maior valor primeiro)
      let potenciaisMais4Query = `
        WITH cliente_historico AS (
          SELECT
            cod_cliente,
            raw_data->>'nome_cliente' as nome_cliente,
            COUNT(*) as quantidade_vendas,
            SUM(valor_liquido) as investimento_total,
            MAX(dt_lancamento) as ultima_compra
          FROM contas_receber
          WHERE confirmado = 'S'
            AND valor_liquido > 0
      `;

      const potenciaisParams = [];
      let paramIndex = 1;

      if (estabelecimentosFiltro.length > 0) {
        potenciaisMais4Query += ` AND cod_estab = ANY($${paramIndex})`;
        potenciaisParams.push(estabelecimentosFiltro);
        paramIndex++;
      }

      potenciaisMais4Query += `
          GROUP BY cod_cliente, raw_data->>'nome_cliente'
        )
        SELECT
          cod_cliente,
          COALESCE(nome_cliente, 'Cliente ' || cod_cliente) as cliente,
          quantidade_vendas as "quantidadeVendas",
          ROUND(investimento_total::numeric, 2) as investimento,
          EXTRACT(DAY FROM NOW() - ultima_compra)::integer as dias_sem_vir
        FROM cliente_historico
        WHERE nome_cliente IS NOT NULL
          AND nome_cliente != ''
          AND EXTRACT(DAY FROM NOW() - ultima_compra) > 120
        ORDER BY investimento_total DESC
        LIMIT 100
      `;

      // 3. Query para buscar POTENCIAIS 1-4 meses (30-120 dias sem comprar)
      let potenciaisMenos4Query = `
        WITH cliente_historico AS (
          SELECT
            cod_cliente,
            raw_data->>'nome_cliente' as nome_cliente,
            COUNT(*) as quantidade_vendas,
            SUM(valor_liquido) as investimento_total,
            MAX(dt_lancamento) as ultima_compra
          FROM contas_receber
          WHERE confirmado = 'S'
            AND valor_liquido > 0
      `;

      if (estabelecimentosFiltro.length > 0) {
        potenciaisMenos4Query += ` AND cod_estab = ANY($1)`;
      }

      potenciaisMenos4Query += `
          GROUP BY cod_cliente, raw_data->>'nome_cliente'
        )
        SELECT
          cod_cliente,
          COALESCE(nome_cliente, 'Cliente ' || cod_cliente) as cliente,
          quantidade_vendas as "quantidadeVendas",
          ROUND(investimento_total::numeric, 2) as investimento,
          EXTRACT(DAY FROM NOW() - ultima_compra)::integer as dias_sem_vir
        FROM cliente_historico
        WHERE nome_cliente IS NOT NULL
          AND nome_cliente != ''
          AND EXTRACT(DAY FROM NOW() - ultima_compra) > 30
          AND EXTRACT(DAY FROM NOW() - ultima_compra) <= 120
        ORDER BY investimento_total DESC
        LIMIT 100
      `;

      // Executar ambas as queries
      const [potenciaisMais4Result, potenciaisMenos4Result] = await Promise.all([
        db.query(potenciaisMais4Query, potenciaisParams),
        db.query(potenciaisMenos4Query, potenciaisParams),
      ]);

      const potenciaisMais4Meses = potenciaisMais4Result.rows.map(row => ({
        cliente: row.cliente,
        clienteId: row.cod_cliente,
        quantidadeVendas: parseInt(row.quantidadeVendas) || 0,
        investimento: parseFloat(row.investimento) || 0,
        diasSemVir: parseInt(row.dias_sem_vir) || 0,
      }));

      const potenciaisMenos4Meses = potenciaisMenos4Result.rows.map(row => ({
        cliente: row.cliente,
        clienteId: row.cod_cliente,
        quantidadeVendas: parseInt(row.quantidadeVendas) || 0,
        investimento: parseFloat(row.investimento) || 0,
        diasSemVir: parseInt(row.dias_sem_vir) || 0,
      }));

      logger.debug(`[DB] getPacientesAnalyticsFromDB: ${faturamentoPaciente.length} clientes ativos, ${potenciaisMais4Meses.length} +4m, ${potenciaisMenos4Meses.length} -4m em ${Date.now() - timer}ms`);

      return {
        totalClientes: faturamentoPaciente.length,
        faturamentoPaciente: faturamentoPaciente.slice(0, 100),
        potenciaisMais4Meses: potenciaisMais4Meses.slice(0, 100),
        potenciaisMenos4Meses: potenciaisMenos4Meses.slice(0, 100),
      };
    } catch (error) {
      logger.error('[DB] Erro em getPacientesAnalyticsFromDB:', error.message);
      return {
        totalClientes: 0,
        faturamentoPaciente: [],
        potenciaisMais4Meses: [],
        potenciaisMenos4Meses: [],
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

  /**
   * Mapeia ID de motivo de desqualificação para nome
   * Usa o campo "Desqualificado" (UF_CRM_1748611226066)
   */
  getMotivoDesqualificacaoName(motivoId) {
    // Mapeamento do novo campo "Desqualificado" (UF_CRM_1748611226066)
    const DESQUALIFICADO_MAP = {
      '7952': 'Propaganda/vendedor',
      '7954': 'Envio de Curriculo',
      '7956': 'Envio de Pós pela enfermagem',
      '7958': 'Envio da Pesquisa de Satisfação',
      '7960': 'Sem resposta após a 7ª Tentativa',
      '7962': 'Reação do Instagram',
      '8012': 'Solicitação de exame/receita/atestado',
      '8014': 'Paciente não quis agendar por não ter vaga de imediato - Convenios',
      '8016': 'Duvidas sobre exame/receita/agendamento',
      '8018': 'Paciente da convênios deixou de responder',
      '8020': 'Paciente Agradeceu a Ultima Mensagem',
      '8022': 'Assunto não relacionado a Clinica',
      '8024': 'Paciente optou por outra Clinica',
      '8032': 'Não é do estado e não pretende vir',
      '8034': 'O Convenio do Paciente não é atendido na clinica',
      '8036': 'Paciente Solicitou Não Receber mais Mensagens',
      '8038': 'Paciente desistiu do Cartão Presente',
      '8040': 'Envio de Nota Fiscal',
      '8042': 'Paciente Optou Por Não Continuar o Atendimento e Não deu Mais Informações',
      '8126': 'Lead do Instagram Sem Contato',
      '8274': 'Lead não possui mais o telefone',
      '8478': 'Migração para novo número nutrologia',
      '8506': 'Convite',
      '8518': 'Envio de exame',
      '8530': 'Migração para novo número Convênios',
      'NAO_PREENCHIDO': 'Não preenchido',
    };
    return DESQUALIFICADO_MAP[String(motivoId)] || 'Não identificado';
  }

  // ==================== MARKETING - PROCEDIMENTOS E PROFISSIONAIS ====================

  /**
   * Busca procedimentos mais vendidos do banco de dados
   * Extrai de vendas.raw_data->itens_venda
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProcedimentosMaisVendidos(startDate, endDate, limit = 20) {
    try {
      // Query que extrai itens_venda do raw_data e agrupa por procedimento
      const query = `
        WITH itens_expandidos AS (
          SELECT
            jsonb_array_elements(raw_data->'itens_venda') as item,
            v.cod_estab,
            v.data_venda
          FROM vendas v
          WHERE v.data_venda >= $1
            AND v.data_venda < ($2::date + interval '1 day')
            AND v.confirmado = 'S'
            AND raw_data->'itens_venda' IS NOT NULL
        )
        SELECT
          item->>'desc_item' as nome,
          COUNT(*) as quantidade,
          SUM(COALESCE((item->>'valor_liquido')::numeric, 0)) as valor
        FROM itens_expandidos
        WHERE item->>'desc_item' IS NOT NULL
          AND item->>'desc_item' != ''
        GROUP BY item->>'desc_item'
        ORDER BY valor DESC
        LIMIT $3
      `;

      const result = await db.query(query, [startDate, endDate, limit]);

      logger.debug(`[DB] getProcedimentosMaisVendidos: ${result.rows.length} procedimentos encontrados`);

      return result.rows.map(row => ({
        nome: row.nome,
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getProcedimentosMaisVendidos:', error.message);
      return [];
    }
  }

  /**
   * Busca profissionais com mais vendas/faturamento do banco de dados
   * Combina dados de vendas.nome_profissional e raw_data
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProfissionaisMaisVendas(startDate, endDate, limit = 20) {
    try {
      // Query que busca profissionais das vendas
      const query = `
        SELECT
          COALESCE(nome_profissional, 'Não identificado') as nome,
          COUNT(*) as vendas,
          SUM(COALESCE(valor_venda, 0)) as valor
        FROM vendas
        WHERE data_venda >= $1
          AND data_venda < ($2::date + interval '1 day')
          AND confirmado = 'S'
          AND nome_profissional IS NOT NULL
          AND nome_profissional != ''
        GROUP BY nome_profissional
        ORDER BY valor DESC
        LIMIT $3
      `;

      const result = await db.query(query, [startDate, endDate, limit]);

      logger.debug(`[DB] getProfissionaisMaisVendas: ${result.rows.length} profissionais encontrados`);

      return result.rows.map(row => ({
        nome: row.nome,
        vendas: parseInt(row.vendas) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getProfissionaisMaisVendas:', error.message);
      return [];
    }
  }

  /**
   * Busca motivos de desqualificação baseado no campo "Desqualificado" (UF_CRM_1748611226066)
   * Filtra pela data de MODIFICAÇÃO do lead (quando o campo foi preenchido)
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async getMotivosDesqualificacao(startDate, endDate) {
    const timer = Date.now();

    try {
      // Busca leads com campo "Desqualificado" (UF_CRM_1748611226066) preenchido
      // no período pela data de MODIFICAÇÃO
      const result = await db.query(`
        SELECT
          l.custom_fields->>'UF_CRM_1748611226066' as motivo_id,
          COUNT(*) as count
        FROM leads l
        WHERE l.custom_fields->>'UF_CRM_1748611226066' IS NOT NULL
          AND l.custom_fields->>'UF_CRM_1748611226066' != ''
          AND l.bitrix_modified_at >= $1
          AND l.bitrix_modified_at < ($2::date + interval '1 day')
        GROUP BY l.custom_fields->>'UF_CRM_1748611226066'
        ORDER BY count DESC
      `, [startDate, endDate]);

      const byMotivoDesqualificacao = result.rows.map(row => {
        const motivoId = row.motivo_id || 'NAO_PREENCHIDO';
        return {
          id: motivoId,
          name: this.getMotivoDesqualificacaoName(motivoId),
          count: parseInt(row.count) || 0,
        };
      });

      // Calcular total de leads desqualificados
      const totalDesqualificados = byMotivoDesqualificacao.reduce((sum, m) => sum + m.count, 0);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getMotivosDesqualificacao: ${totalDesqualificados} leads em ${duration}ms`);

      return {
        byMotivoDesqualificacao,
        totalDesqualificados,
      };
    } catch (error) {
      logger.error('[DB] Erro em getMotivosDesqualificacao:', error.message);
      return {
        byMotivoDesqualificacao: [],
        totalDesqualificados: 0,
      };
    }
  }

  // ==================== PROCEDIMENTOS E PROFISSIONAIS DO CACHE ====================

  /**
   * Busca procedimentos mais vendidos do cache (carregamento instantâneo)
   * Usa dados pré-agregados mensalmente pelo sync
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProcedimentosFromCache(startDate, endDate, limit = 20) {
    const timer = Date.now();

    try {
      // Extrai meses do período
      const startMonth = startDate.substring(0, 7); // yyyy-MM
      const endMonth = endDate.substring(0, 7);

      // Termos a excluir (não são procedimentos reais)
      const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

      // Query que agrega dados de múltiplos meses com filtro de exclusão
      const query = `
        SELECT
          nome,
          SUM(quantidade) as quantidade,
          SUM(valor) as valor
        FROM procedimentos_cache
        WHERE ano_mes >= $1 AND ano_mes <= $2
          AND NOT (LOWER(nome) LIKE ANY(ARRAY[${excludeTerms.map((_, i) => `$${i + 4}`).join(', ')}]))
        GROUP BY nome
        ORDER BY valor DESC
        LIMIT $3
      `;

      const excludePatterns = excludeTerms.map(t => `%${t}%`);

      const result = await db.query(query, [startMonth, endMonth, limit, ...excludePatterns]);

      logger.debug(`[DB Cache] getProcedimentosFromCache: ${result.rows.length} procedimentos em ${Date.now() - timer}ms`);

      return result.rows.map(row => ({
        nome: row.nome,
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB Cache] Erro em getProcedimentosFromCache:', error.message);
      return [];
    }
  }

  /**
   * Busca procedimentos ordenados por quantidade (mais vendidos em unidades)
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProcedimentosByQuantidade(startDate, endDate, limit = 20) {
    const timer = Date.now();

    try {
      // Extrai meses do período
      const startMonth = startDate.substring(0, 7); // yyyy-MM
      const endMonth = endDate.substring(0, 7);

      // Termos a excluir (não são procedimentos reais)
      const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

      // Query que agrega dados de múltiplos meses ordenando por QUANTIDADE
      const query = `
        SELECT
          nome,
          SUM(quantidade) as quantidade,
          SUM(valor) as valor
        FROM procedimentos_cache
        WHERE ano_mes >= $1 AND ano_mes <= $2
          AND NOT (LOWER(nome) LIKE ANY(ARRAY[${excludeTerms.map((_, i) => `$${i + 4}`).join(', ')}]))
        GROUP BY nome
        ORDER BY quantidade DESC
        LIMIT $3
      `;

      const excludePatterns = excludeTerms.map(t => `%${t}%`);

      const result = await db.query(query, [startMonth, endMonth, limit, ...excludePatterns]);

      logger.debug(`[DB Cache] getProcedimentosByQuantidade: ${result.rows.length} procedimentos em ${Date.now() - timer}ms`);

      return result.rows.map(row => ({
        nome: row.nome,
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB Cache] Erro em getProcedimentosByQuantidade:', error.message);
      return [];
    }
  }

  /**
   * Busca procedimentos AGRUPADOS POR ESTABELECIMENTO
   * Para períodos curtos (<= 14 dias), usa tabela procedimentos_diarios (dados do banco, sem delay)
   * Para períodos maiores, usa o cache mensal
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limitPerEstab - Limite de procedimentos por estabelecimento
   * @returns {Object} { nomeEstab: { byValor: [], byQuantidade: [] } }
   */
  async getProcedimentosPorEstabelecimento(startDate, endDate, limitPerEstab = 10) {
    const timer = Date.now();

    try {
      // Calcula dias no período
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      // Para períodos curtos (<= 14 dias), usa tabela procedimentos_diarios
      // Estes dados são sincronizados a cada 5 min pelo sync (sem delay de API)
      if (diffDays <= 14) {
        return this.getProcedimentosPorEstabelecimentoFromDiarios(startDate, endDate, limitPerEstab);
      }

      // Para períodos maiores, usa o cache mensal (mais rápido)
      const startMonth = startDate.substring(0, 7); // yyyy-MM
      const endMonth = endDate.substring(0, 7);

      // Termos a excluir (não são procedimentos reais)
      const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

      // Query que busca procedimentos agrupados por estabelecimento
      const query = `
        SELECT
          cod_estab,
          nome_estab,
          nome,
          SUM(quantidade) as quantidade,
          SUM(valor) as valor
        FROM procedimentos_cache
        WHERE ano_mes >= $1 AND ano_mes <= $2
          AND cod_estab IS NOT NULL
          AND NOT (LOWER(nome) LIKE ANY(ARRAY[${excludeTerms.map((_, i) => `$${i + 3}`).join(', ')}]))
        GROUP BY cod_estab, nome_estab, nome
        ORDER BY cod_estab, valor DESC
      `;

      const excludePatterns = excludeTerms.map(t => `%${t}%`);
      const result = await db.query(query, [startMonth, endMonth, ...excludePatterns]);

      // Agrupa por estabelecimento
      const porEstab = {};

      result.rows.forEach(row => {
        const estabKey = row.nome_estab || `Estab ${row.cod_estab}`;

        if (!porEstab[estabKey]) {
          porEstab[estabKey] = {
            cod_estab: row.cod_estab,
            nome_estab: estabKey,
            procedimentos: [],
          };
        }

        porEstab[estabKey].procedimentos.push({
          nome: row.nome,
          quantidade: parseInt(row.quantidade) || 0,
          valor: parseFloat(row.valor) || 0,
        });
      });

      // Para cada estabelecimento, criar arrays byValor e byQuantidade
      const resultado = {};

      Object.entries(porEstab).forEach(([estabKey, data]) => {
        const procs = data.procedimentos;

        resultado[estabKey] = {
          cod_estab: data.cod_estab,
          nome_estab: data.nome_estab,
          byValor: procs
            .sort((a, b) => b.valor - a.valor)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
          byQuantidade: [...procs]
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
        };
      });

      logger.debug(`[DB Cache] getProcedimentosPorEstabelecimento: ${Object.keys(resultado).length} estabelecimentos em ${Date.now() - timer}ms`);

      return resultado;
    } catch (error) {
      logger.error('[DB Cache] Erro em getProcedimentosPorEstabelecimento:', error.message);
      return {};
    }
  }

  /**
   * Busca procedimentos por estabelecimento da TABELA PROCEDIMENTOS_DIARIOS
   * Esta tabela é populada pelo sync a cada 5 min com dados da Belle API
   * Extrai serviços de planos para mostrar procedimentos reais
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limitPerEstab - Limite de procedimentos por estabelecimento
   */
  async getProcedimentosPorEstabelecimentoFromDiarios(startDate, endDate, limitPerEstab = 10) {
    const timer = Date.now();

    try {
      // Mapeamento de cod_estab para nome (igual ao config/index.js)
      const ESTAB_NAMES = {
        1: 'Dermato',
        2: 'SPA',
        5: 'Convênio',
        10: 'Drips',
        11: 'Estética',
        12: 'Bela Laser',
        14: 'Nutrologia',
      };

      // Query que busca procedimentos agrupados por estabelecimento da tabela procedimentos_diarios
      const query = `
        SELECT
          cod_estab,
          nome_estab,
          nome_proc as nome,
          SUM(quantidade) as quantidade,
          SUM(valor) as valor
        FROM procedimentos_diarios
        WHERE data_ref >= $1 AND data_ref <= $2
          AND cod_estab IS NOT NULL
        GROUP BY cod_estab, nome_estab, nome_proc
        ORDER BY cod_estab, valor DESC
      `;

      const result = await db.query(query, [startDate, endDate]);

      // Agrupa por estabelecimento
      const porEstab = {};

      result.rows.forEach(row => {
        // Usa nome do mapeamento ou da tabela
        const estabKey = ESTAB_NAMES[row.cod_estab] || row.nome_estab || `Estab ${row.cod_estab}`;

        if (!porEstab[estabKey]) {
          porEstab[estabKey] = {
            cod_estab: row.cod_estab,
            nome_estab: estabKey,
            procedimentos: [],
          };
        }

        porEstab[estabKey].procedimentos.push({
          nome: row.nome,
          quantidade: parseInt(row.quantidade) || 0,
          valor: parseFloat(row.valor) || 0,
        });
      });

      // Para cada estabelecimento, criar arrays byValor e byQuantidade
      const resultado = {};

      Object.entries(porEstab).forEach(([estabKey, data]) => {
        const procs = data.procedimentos;

        resultado[estabKey] = {
          cod_estab: data.cod_estab,
          nome_estab: data.nome_estab,
          byValor: procs
            .sort((a, b) => b.valor - a.valor)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
          byQuantidade: [...procs]
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
        };
      });

      logger.debug(`[DB Diarios] getProcedimentosPorEstabelecimentoFromDiarios: ${Object.keys(resultado).length} estabelecimentos em ${Date.now() - timer}ms`);

      return resultado;
    } catch (error) {
      logger.error('[DB Diarios] Erro em getProcedimentosPorEstabelecimentoFromDiarios:', error.message);
      // Fallback para vendas se tabela não existir
      logger.warn('[DB Diarios] Fallback para getProcedimentosPorEstabelecimentoFromVendas');
      return this.getProcedimentosPorEstabelecimentoFromVendas(startDate, endDate, limitPerEstab);
    }
  }

  /**
   * Busca procedimentos por estabelecimento DIRETO DA TABELA VENDAS
   * Usa datas exatas para períodos curtos (hoje, última semana, etc.)
   * Agrupa itens não-procedimentos (voucher, planos, etc) em "Outros" para garantir
   * que todos os estabelecimentos com vendas apareçam no resultado
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limitPerEstab - Limite de procedimentos por estabelecimento
   */
  async getProcedimentosPorEstabelecimentoFromVendas(startDate, endDate, limitPerEstab = 10) {
    const timer = Date.now();

    try {
      // Termos a agrupar em "Outros" (não são procedimentos reais mas contam como faturamento)
      const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

      // Mapeamento de cod_estab para nome (igual ao config/index.js)
      const ESTAB_NAMES = {
        1: 'Dermato',
        2: 'SPA',
        5: 'Convênio',
        10: 'Drips',
        11: 'Estética',
        12: 'Bela Laser',
        14: 'Nutrologia',
      };

      // Query que extrai itens_venda do JSON agrupando por estabelecimento
      const query = `
        SELECT
          v.cod_estab,
          item->>'desc_item' as nome,
          COUNT(*) as quantidade,
          SUM(CAST(COALESCE(item->>'valor_liquido', '0') AS DECIMAL)) as valor
        FROM vendas v, jsonb_array_elements(raw_data->'itens_venda') as item
        WHERE v.data_venda >= $1
          AND v.data_venda <= $2
          AND v.confirmado = 'S'
          AND item->>'desc_item' IS NOT NULL
          AND item->>'desc_item' != ''
        GROUP BY v.cod_estab, item->>'desc_item'
        ORDER BY v.cod_estab, valor DESC
      `;

      const result = await db.query(query, [startDate, endDate]);

      // Agrupa por estabelecimento, separando procedimentos de "Outros"
      const porEstab = {};

      result.rows.forEach(row => {
        const nomeLower = (row.nome || '').toLowerCase();
        const isExcluded = excludeTerms.some(term => nomeLower.includes(term));

        const estabKey = ESTAB_NAMES[row.cod_estab] || `Estab ${row.cod_estab}`;

        if (!porEstab[estabKey]) {
          porEstab[estabKey] = {
            cod_estab: row.cod_estab,
            nome_estab: estabKey,
            procedimentos: [],
            outros: { nome: 'Outros (Planos/Vouchers)', quantidade: 0, valor: 0 },
          };
        }

        if (isExcluded) {
          // Agrupa itens excluídos em "Outros"
          porEstab[estabKey].outros.quantidade += parseInt(row.quantidade) || 0;
          porEstab[estabKey].outros.valor += parseFloat(row.valor) || 0;
        } else {
          porEstab[estabKey].procedimentos.push({
            nome: row.nome,
            quantidade: parseInt(row.quantidade) || 0,
            valor: parseFloat(row.valor) || 0,
          });
        }
      });

      // Para cada estabelecimento, criar arrays byValor e byQuantidade
      const resultado = {};

      Object.entries(porEstab).forEach(([estabKey, data]) => {
        let procs = data.procedimentos;

        // Se o estabelecimento só tem "Outros", inclui na lista para aparecer no gráfico
        // Considera valor > 0 OU quantidade > 0 (para casos onde valor é 0 mas há itens)
        if (procs.length === 0 && (data.outros.valor > 0 || data.outros.quantidade > 0)) {
          procs = [data.outros];
        } else if (data.outros.valor > 0 || data.outros.quantidade > 0) {
          // Adiciona "Outros" ao final se houver valor ou quantidade
          procs = [...procs, data.outros];
        }

        resultado[estabKey] = {
          cod_estab: data.cod_estab,
          nome_estab: data.nome_estab,
          byValor: procs
            .sort((a, b) => b.valor - a.valor)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
          byQuantidade: [...procs]
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, limitPerEstab)
            .map(p => ({
              ...p,
              valorFormatado: p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            })),
        };
      });

      logger.debug(`[DB Vendas] getProcedimentosPorEstabelecimentoFromVendas: ${Object.keys(resultado).length} estabelecimentos em ${Date.now() - timer}ms`);

      return resultado;
    } catch (error) {
      logger.error('[DB Vendas] Erro em getProcedimentosPorEstabelecimentoFromVendas:', error.message);
      return {};
    }
  }

  /**
   * Busca procedimentos mais vendidos diretamente da tabela de vendas (mais completo)
   * Extrai itens_venda do JSON e agrega por nome do procedimento
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   * @param {string[]} excludeTerms - Termos a serem excluídos (ex: 'plano personalizado')
   */
  async getProcedimentosFromVendas(startDate, endDate, limit = 20, excludeTerms = []) {
    const timer = Date.now();

    try {
      // Termos padrão para excluir (não são procedimentos reais)
      const defaultExclude = ['plano personalizado', 'voucher', 'produtos', 'credito'];
      const allExcludeTerms = [...new Set([...defaultExclude, ...excludeTerms.map(t => t.toLowerCase())])];

      // Query que extrai itens_venda do JSON e agrega por nome
      const query = `
        SELECT
          item->>'desc_item' as nome,
          COUNT(*) as quantidade,
          SUM(CAST(COALESCE(item->>'valor_liquido', '0') AS DECIMAL)) as valor
        FROM vendas, jsonb_array_elements(raw_data->'itens_venda') as item
        WHERE data_venda >= $1
          AND data_venda <= $2
          AND item->>'desc_item' IS NOT NULL
          AND item->>'desc_item' != ''
        GROUP BY item->>'desc_item'
        ORDER BY valor DESC
        LIMIT $3
      `;

      const result = await db.query(query, [startDate, endDate, limit * 2]); // Busca mais para compensar filtros

      // Filtra termos excluídos e limita resultados
      const filtered = result.rows
        .filter(row => {
          const nomeLower = row.nome.toLowerCase();
          return !allExcludeTerms.some(term => nomeLower.includes(term));
        })
        .slice(0, limit);

      logger.debug(`[DB] getProcedimentosFromVendas: ${filtered.length} procedimentos em ${Date.now() - timer}ms (de ${result.rows.length} total)`);

      return filtered.map(row => ({
        nome: row.nome,
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getProcedimentosFromVendas:', error.message);
      return [];
    }
  }

  /**
   * Busca profissionais com mais vendas do cache (carregamento instantâneo)
   * Para períodos curtos (< 28 dias), busca direto da tabela vendas
   * Para períodos maiores, usa o cache mensal
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProfissionaisFromCache(startDate, endDate, limit = 20) {
    const timer = Date.now();

    try {
      // Calcula dias no período
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      // Para períodos curtos (menos de 28 dias), busca direto da tabela vendas
      // Isso garante precisão quando o usuário filtra por "hoje", "última semana", etc.
      if (diffDays < 28) {
        return this.getProfissionaisFromVendas(startDate, endDate, limit);
      }

      // Para períodos maiores, usa o cache mensal (mais rápido)
      const startMonth = startDate.substring(0, 7); // yyyy-MM
      const endMonth = endDate.substring(0, 7);

      // Query que agrega dados de múltiplos meses
      const query = `
        SELECT
          nome,
          SUM(vendas) as vendas,
          SUM(valor) as valor
        FROM profissionais_cache
        WHERE ano_mes >= $1 AND ano_mes <= $2
        GROUP BY nome
        ORDER BY valor DESC
        LIMIT $3
      `;

      const result = await db.query(query, [startMonth, endMonth, limit]);

      logger.debug(`[DB Cache] getProfissionaisFromCache: ${result.rows.length} profissionais em ${Date.now() - timer}ms`);

      return result.rows.map(row => ({
        nome: row.nome,
        vendas: parseInt(row.vendas) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB Cache] Erro em getProfissionaisFromCache:', error.message);
      return [];
    }
  }

  /**
   * Busca profissionais DIRETO DA TABELA VENDAS
   * Usa datas exatas para períodos curtos (hoje, última semana, etc.)
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {number} limit - Número máximo de resultados
   */
  async getProfissionaisFromVendas(startDate, endDate, limit = 20) {
    const timer = Date.now();

    try {
      // Query que busca profissionais das vendas com datas exatas
      const query = `
        SELECT
          COALESCE(nome_profissional, 'Não identificado') as nome,
          COUNT(*) as vendas,
          SUM(COALESCE(valor_venda, 0)) as valor
        FROM vendas
        WHERE data_venda >= $1
          AND data_venda <= $2
          AND confirmado = 'S'
          AND nome_profissional IS NOT NULL
          AND nome_profissional != ''
        GROUP BY nome_profissional
        ORDER BY valor DESC
        LIMIT $3
      `;

      const result = await db.query(query, [startDate, endDate, limit]);

      logger.debug(`[DB Vendas] getProfissionaisFromVendas: ${result.rows.length} profissionais em ${Date.now() - timer}ms`);

      return result.rows.map(row => ({
        nome: row.nome,
        vendas: parseInt(row.vendas) || 0,
        valor: parseFloat(row.valor) || 0,
      }));
    } catch (error) {
      logger.error('[DB Vendas] Erro em getProfissionaisFromVendas:', error.message);
      return [];
    }
  }

  /**
   * Verifica se há dados de cache disponíveis para um período
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async hasCacheData(startDate, endDate) {
    try {
      const startMonth = startDate.substring(0, 7);
      const endMonth = endDate.substring(0, 7);

      const result = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM procedimentos_cache WHERE ano_mes >= $1 AND ano_mes <= $2) as proc_count,
          (SELECT COUNT(*) FROM profissionais_cache WHERE ano_mes >= $1 AND ano_mes <= $2) as prof_count
      `, [startMonth, endMonth]);

      const row = result.rows[0] || {};
      return {
        hasProcedimentos: parseInt(row.proc_count) > 0,
        hasProfissionais: parseInt(row.prof_count) > 0,
        procedimentosCount: parseInt(row.proc_count) || 0,
        profissionaisCount: parseInt(row.prof_count) || 0,
      };
    } catch (error) {
      logger.error('[DB Cache] Erro em hasCacheData:', error.message);
      return {
        hasProcedimentos: false,
        hasProfissionais: false,
        procedimentosCount: 0,
        profissionaisCount: 0,
      };
    }
  }

  // ==================== DEALS DO BANCO DE DADOS ====================

  /**
   * Busca deals WON do banco de dados (muito mais rápido que API)
   * Retorna lista de lead_ids que viraram deal WON e métricas agregadas
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async getDealsWonFromDB(startDate, endDate) {
    const timer = Date.now();

    try {
      // Busca deals WON no período
      // WON deals have stage_id ending with ':WON' (e.g., 'C42:WON', 'C54:WON', 'C50:WON')
      const result = await db.query(`
        SELECT
          d.bitrix_id,
          d.contact_id,
          d.opportunity,
          d.bitrix_created_at,
          d.custom_fields
        FROM deals d
        WHERE d.stage_id LIKE '%:WON'
          AND d.bitrix_created_at >= $1
          AND d.bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      const deals = result.rows;

      // Extrair lead_ids dos deals (vem do custom_field LEAD_ID ou contact_id)
      const leadsComDealWon = [];
      let wonDealsValue = 0;

      deals.forEach(deal => {
        // O lead_id pode vir do custom_fields ou ser o próprio bitrix_id convertido
        const customFields = deal.custom_fields || {};
        const leadId = customFields.LEAD_ID || String(deal.bitrix_id);

        if (leadId && !leadsComDealWon.includes(leadId)) {
          leadsComDealWon.push(leadId);
        }

        wonDealsValue += parseFloat(deal.opportunity) || 0;
      });

      const duration = Date.now() - timer;
      logger.debug(`[DB] getDealsWonFromDB: ${deals.length} deals WON, ${leadsComDealWon.length} leads em ${duration}ms`);

      return {
        leadsComDealWon,
        wonDealsCount: deals.length,
        wonDealsValue,
      };
    } catch (error) {
      logger.error('[DB] Erro em getDealsWonFromDB:', error.message);
      return {
        leadsComDealWon: [],
        wonDealsCount: 0,
        wonDealsValue: 0,
      };
    }
  }

  /**
   * Busca deals LOST do banco de dados com motivos de desqualificação
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async getDealsLostFromDB(startDate, endDate) {
    const timer = Date.now();

    try {
      // Busca deals LOST no período
      // LOST deals have stage_id ending with ':LOSE' (e.g., 'C42:LOSE', 'C54:LOSE')
      const result = await db.query(`
        SELECT
          d.bitrix_id,
          d.custom_fields,
          d.bitrix_created_at
        FROM deals d
        WHERE d.stage_id LIKE '%:LOSE'
          AND d.bitrix_created_at >= $1
          AND d.bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      const deals = result.rows;

      // Agrupar por motivo de desqualificação (campo UF_CRM_1695041103 no deal)
      const byMotivoMap = {};

      deals.forEach(deal => {
        const customFields = deal.custom_fields || {};
        // Campo de motivo de desqualificação em deals
        const motivoId = customFields.UF_CRM_1695041103 || 'NAO_PREENCHIDO';

        if (!byMotivoMap[motivoId]) {
          byMotivoMap[motivoId] = {
            id: motivoId,
            name: this.getMotivoDesqualificacaoDealsName(motivoId),
            count: 0,
          };
        }
        byMotivoMap[motivoId].count++;
      });

      const byMotivoDesqualificacao = Object.values(byMotivoMap).sort((a, b) => b.count - a.count);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getDealsLostFromDB: ${deals.length} deals LOST em ${duration}ms`);

      return {
        byMotivoDesqualificacao,
        lostDealsCount: deals.length,
      };
    } catch (error) {
      logger.error('[DB] Erro em getDealsLostFromDB:', error.message);
      return {
        byMotivoDesqualificacao: [],
        lostDealsCount: 0,
      };
    }
  }

  /**
   * Mapeia ID de motivo de desqualificação de DEALS para nome
   * (pode ser diferente do mapa de leads)
   */
  getMotivoDesqualificacaoDealsName(motivoId) {
    // Usa o mesmo mapeamento de leads por enquanto
    // Pode ser customizado se os motivos de deals forem diferentes
    return this.getMotivoDesqualificacaoName(motivoId);
  }

  /**
   * Busca centros de custo (estabelecimentos) distintos do banco de dados
   */
  async getCentrosCustoFromDB() {
    const timer = Date.now();
    try {
      const query = `
        SELECT DISTINCT
          centro_custo_id as id,
          centro_custo as nome
        FROM vendas
        WHERE centro_custo IS NOT NULL
          AND centro_custo != ''
        ORDER BY centro_custo
      `;
      const result = await db.query(query);
      const duration = Date.now() - timer;
      logger.debug(`[DB] getCentrosCustoFromDB: ${result.rows.length} centros em ${duration}ms`);
      return result.rows.map(row => ({
        id: row.id,
        nome: row.nome,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getCentrosCustoFromDB:', error.message);
      return [];
    }
  }

  // ==================== CONVERSION TIME METRICS ====================

  /**
   * Calcula métricas de tempo de conversão do banco de dados
   * Usa a tabela lead_status_history para calcular tempo entre estágios
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @returns {Object} Métricas de conversão
   */
  async getConversionTimeMetrics(startDate, endDate) {
    const timer = Date.now();

    try {
      // Primeiro tenta usar a tabela lead_status_history
      const historyResult = await db.query(`
        WITH converted_leads AS (
          -- Leads que foram convertidos (status semântico S) no período
          SELECT DISTINCT
            l.id,
            l.bitrix_id,
            l.bitrix_created_at,
            l.bitrix_closed_at,
            l.conversion_days
          FROM leads l
          JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
          WHERE ls.semantica = 'S'
            AND l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        ),
        in_progress_leads AS (
          -- Leads ainda em progresso (status semântico P)
          SELECT DISTINCT
            l.id,
            l.bitrix_id,
            l.bitrix_created_at
          FROM leads l
          JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
          WHERE ls.semantica = 'P'
            AND l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        ),
        conversion_times AS (
          SELECT
            COALESCE(
              conversion_days,
              CASE
                WHEN bitrix_closed_at IS NOT NULL
                THEN EXTRACT(DAY FROM bitrix_closed_at - bitrix_created_at)::INTEGER
                ELSE NULL
              END
            ) AS days_to_convert
          FROM converted_leads
          WHERE COALESCE(
            conversion_days,
            CASE
              WHEN bitrix_closed_at IS NOT NULL
              THEN EXTRACT(DAY FROM bitrix_closed_at - bitrix_created_at)::INTEGER
              ELSE NULL
            END
          ) BETWEEN 0 AND 365
        ),
        progress_times AS (
          SELECT
            EXTRACT(DAY FROM NOW() - bitrix_created_at)::INTEGER AS days_in_progress
          FROM in_progress_leads
          WHERE EXTRACT(DAY FROM NOW() - bitrix_created_at)::INTEGER BETWEEN 0 AND 365
        )
        SELECT
          (SELECT ROUND(AVG(days_to_convert), 1) FROM conversion_times) AS avg_conversion_days,
          (SELECT ROUND(AVG(days_in_progress), 1) FROM progress_times) AS avg_in_progress_days,
          (SELECT COUNT(*) FROM converted_leads) AS total_converted,
          (SELECT COUNT(*) FROM in_progress_leads) AS total_in_progress
      `, [startDate, endDate]);

      const row = historyResult.rows[0] || {};

      // Calcular distribuição de tempos de conversão
      const distributionResult = await db.query(`
        WITH conversion_times AS (
          SELECT
            COALESCE(
              l.conversion_days,
              CASE
                WHEN l.bitrix_closed_at IS NOT NULL
                THEN EXTRACT(DAY FROM l.bitrix_closed_at - l.bitrix_created_at)::INTEGER
                ELSE NULL
              END
            ) AS days
          FROM leads l
          JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
          WHERE ls.semantica = 'S'
            AND l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        )
        SELECT
          CASE
            WHEN days <= 1 THEN '0-1 dia'
            WHEN days <= 3 THEN '2-3 dias'
            WHEN days <= 7 THEN '4-7 dias'
            WHEN days <= 14 THEN '8-14 dias'
            WHEN days <= 30 THEN '15-30 dias'
            WHEN days <= 60 THEN '31-60 dias'
            ELSE '60+ dias'
          END AS label,
          COUNT(*) AS count
        FROM conversion_times
        WHERE days IS NOT NULL AND days >= 0 AND days <= 365
        GROUP BY label
        ORDER BY
          CASE label
            WHEN '0-1 dia' THEN 1
            WHEN '2-3 dias' THEN 2
            WHEN '4-7 dias' THEN 3
            WHEN '8-14 dias' THEN 4
            WHEN '15-30 dias' THEN 5
            WHEN '31-60 dias' THEN 6
            ELSE 7
          END
      `, [startDate, endDate]);

      const totalForDistribution = distributionResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

      const conversionTimeDistribution = distributionResult.rows.map(r => ({
        label: r.label,
        count: parseInt(r.count),
        percentage: totalForDistribution > 0
          ? ((parseInt(r.count) / totalForDistribution) * 100).toFixed(1)
          : 0,
      }));

      // Calcular tempo médio por estágio (se houver histórico)
      const stageTimeResult = await db.query(`
        SELECT
          to_status_id,
          to_status_name,
          ROUND(AVG(days_in_previous_status), 1) AS avg_days
        FROM lead_status_history
        WHERE changed_at >= $1
          AND changed_at < ($2::date + interval '1 day')
          AND days_in_previous_status BETWEEN 0 AND 365
        GROUP BY to_status_id, to_status_name
        HAVING COUNT(*) >= 5
        ORDER BY avg_days DESC
        LIMIT 10
      `, [startDate, endDate]);

      const avgTimeByStage = {};
      stageTimeResult.rows.forEach(r => {
        avgTimeByStage[r.to_status_id] = {
          name: r.to_status_name,
          avgDays: parseFloat(r.avg_days) || 0,
        };
      });

      const duration = Date.now() - timer;
      logger.debug(`[DB] getConversionTimeMetrics: em ${duration}ms`);

      return {
        avgConversionDays: parseFloat(row.avg_conversion_days) || 0,
        avgInProgressDays: parseFloat(row.avg_in_progress_days) || 0,
        totalConverted: parseInt(row.total_converted) || 0,
        totalInProgress: parseInt(row.total_in_progress) || 0,
        avgTimeByStage,
        conversionTimeDistribution,
      };
    } catch (error) {
      logger.error('[DB] Erro em getConversionTimeMetrics:', error.message);
      // Fallback: calcular direto dos leads
      return this.getConversionTimeMetricsFallback(startDate, endDate);
    }
  }

  /**
   * Fallback para métricas de conversão quando a tabela lead_status_history não existe
   */
  async getConversionTimeMetricsFallback(startDate, endDate) {
    try {
      const result = await db.query(`
        WITH lead_times AS (
          SELECT
            CASE
              WHEN ls.semantica = 'S' AND l.bitrix_closed_at IS NOT NULL
              THEN EXTRACT(DAY FROM l.bitrix_closed_at - l.bitrix_created_at)::INTEGER
              ELSE NULL
            END AS conversion_days,
            CASE
              WHEN ls.semantica = 'P'
              THEN EXTRACT(DAY FROM NOW() - l.bitrix_created_at)::INTEGER
              ELSE NULL
            END AS in_progress_days,
            ls.semantica
          FROM leads l
          LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
          WHERE l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        )
        SELECT
          ROUND(AVG(conversion_days) FILTER (WHERE conversion_days BETWEEN 0 AND 365), 1) AS avg_conversion_days,
          ROUND(AVG(in_progress_days) FILTER (WHERE in_progress_days BETWEEN 0 AND 365), 1) AS avg_in_progress_days,
          COUNT(*) FILTER (WHERE semantica = 'S') AS total_converted,
          COUNT(*) FILTER (WHERE semantica = 'P') AS total_in_progress
        FROM lead_times
      `, [startDate, endDate]);

      const row = result.rows[0] || {};

      return {
        avgConversionDays: parseFloat(row.avg_conversion_days) || 0,
        avgInProgressDays: parseFloat(row.avg_in_progress_days) || 0,
        totalConverted: parseInt(row.total_converted) || 0,
        totalInProgress: parseInt(row.total_in_progress) || 0,
        avgTimeByStage: {},
        conversionTimeDistribution: [],
      };
    } catch (error) {
      logger.error('[DB] Erro em getConversionTimeMetricsFallback:', error.message);
      return {
        avgConversionDays: 0,
        avgInProgressDays: 0,
        totalConverted: 0,
        totalInProgress: 0,
        avgTimeByStage: {},
        conversionTimeDistribution: [],
      };
    }
  }

  // ==================== MARKETING KPIs: ROAS, CPL, SOURCE ATTRIBUTION ====================

  /**
   * Calcula métricas de marketing: ROAS, CPL e atribuição por fonte
   * Combina dados de leads com dados de faturamento para calcular ROI
   *
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   * @param {Object} adSpend - Gastos por fonte { facebook: X, google: Y, ... }
   * @returns {Object} Métricas de marketing
   */
  async getMarketingROASMetrics(startDate, endDate, adSpend = {}) {
    const timer = Date.now();

    try {
      // 1. Buscar leads convertidos por UTM source
      const leadsResult = await db.query(`
        SELECT
          l.utm_source,
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE ls.semantica = 'S') as leads_convertidos,
          SUM(COALESCE(l.opportunity, 0)) as valor_oportunidade
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY l.utm_source
      `, [startDate, endDate]);

      // 2. Buscar faturamento atribuído a leads convertidos
      // Isso requer correlação leads->vendas (via customer_analytics ou correlação direta)
      const revenueResult = await db.query(`
        SELECT
          l.utm_source,
          SUM(cr.valor_liquido) as receita_atribuida
        FROM leads l
        JOIN customer_analytics ca ON ca.lead_id = l.id
        JOIN contas_receber cr ON cr.cod_cliente = ca.cliente_id
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
          AND ls.semantica = 'S'
          AND cr.dt_lancamento >= $1
          AND cr.dt_lancamento <= $2
          AND cr.confirmado = 'S'
        GROUP BY l.utm_source
      `, [startDate, endDate]);

      // Criar map de receita por fonte
      const revenueBySource = {};
      revenueResult.rows.forEach(r => {
        revenueBySource[r.utm_source || 'direct'] = parseFloat(r.receita_atribuida) || 0;
      });

      // Combinar dados de leads com receita
      const sourceMetrics = leadsResult.rows.map(row => {
        const source = row.utm_source || 'direct';
        const totalLeads = parseInt(row.total_leads) || 0;
        const convertedLeads = parseInt(row.leads_convertidos) || 0;
        const opportunityValue = parseFloat(row.valor_oportunidade) || 0;
        const revenue = revenueBySource[source] || 0;

        // Normalizar nome da fonte para match com adSpend
        const normalizedSource = source.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/-/g, '_');

        // Buscar gasto correspondente
        const spend = adSpend[normalizedSource] ||
                      adSpend[source] ||
                      (normalizedSource.includes('facebook') || normalizedSource.includes('fb') ? adSpend.facebook : 0) ||
                      (normalizedSource.includes('google') || normalizedSource.includes('gads') ? adSpend.google : 0) ||
                      (normalizedSource.includes('instagram') || normalizedSource.includes('ig') ? adSpend.instagram : 0) ||
                      0;

        // Calcular métricas
        const cpl = totalLeads > 0 && spend > 0 ? spend / totalLeads : 0;
        const cpa = convertedLeads > 0 && spend > 0 ? spend / convertedLeads : 0;
        const roas = spend > 0 ? revenue / spend : 0;
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        return {
          source,
          normalizedSource,
          totalLeads,
          convertedLeads,
          opportunityValue,
          revenue,
          spend,
          cpl: Math.round(cpl * 100) / 100,
          cpa: Math.round(cpa * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          conversionRate: Math.round(conversionRate * 10) / 10,
        };
      });

      // Ordenar por total de leads
      sourceMetrics.sort((a, b) => b.totalLeads - a.totalLeads);

      // Calcular totais
      const totals = sourceMetrics.reduce((acc, s) => {
        acc.totalLeads += s.totalLeads;
        acc.convertedLeads += s.convertedLeads;
        acc.revenue += s.revenue;
        acc.spend += s.spend;
        return acc;
      }, { totalLeads: 0, convertedLeads: 0, revenue: 0, spend: 0 });

      totals.overallCPL = totals.totalLeads > 0 && totals.spend > 0
        ? totals.spend / totals.totalLeads
        : 0;
      totals.overallCPA = totals.convertedLeads > 0 && totals.spend > 0
        ? totals.spend / totals.convertedLeads
        : 0;
      totals.overallROAS = totals.spend > 0
        ? totals.revenue / totals.spend
        : 0;
      totals.overallConversionRate = totals.totalLeads > 0
        ? (totals.convertedLeads / totals.totalLeads) * 100
        : 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] getMarketingROASMetrics: ${sourceMetrics.length} fontes em ${duration}ms`);

      return {
        bySource: sourceMetrics,
        totals: {
          ...totals,
          overallCPL: Math.round(totals.overallCPL * 100) / 100,
          overallCPA: Math.round(totals.overallCPA * 100) / 100,
          overallROAS: Math.round(totals.overallROAS * 100) / 100,
          overallConversionRate: Math.round(totals.overallConversionRate * 10) / 10,
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getMarketingROASMetrics:', error.message);
      return {
        bySource: [],
        totals: {
          totalLeads: 0,
          convertedLeads: 0,
          revenue: 0,
          spend: 0,
          overallCPL: 0,
          overallCPA: 0,
          overallROAS: 0,
          overallConversionRate: 0,
        },
      };
    }
  }

  /**
   * Calcula funil de conversão avançado com métricas por estágio
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} Dados do funil
   */
  async getAdvancedFunnel(startDate, endDate) {
    const timer = Date.now();

    try {
      // Buscar contagem de leads por status
      const result = await db.query(`
        SELECT
          ls.nome as status_name,
          ls.semantica,
          ls.sort_order,
          COUNT(*) as count
        FROM leads l
        JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY ls.nome, ls.semantica, ls.sort_order
        ORDER BY ls.sort_order
      `, [startDate, endDate]);

      // Calcular totais por categoria semântica
      const categories = {
        new: { label: 'Novos', count: 0, percentage: 100 },
        inProgress: { label: 'Em Andamento', count: 0, percentage: 0 },
        qualified: { label: 'Qualificados', count: 0, percentage: 0 },
        converted: { label: 'Convertidos', count: 0, percentage: 0 },
        lost: { label: 'Perdidos', count: 0, percentage: 0 },
      };

      const totalLeads = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const statusName = (row.status_name || '').toLowerCase();

        if (statusName === 'novo' || statusName === 'new') {
          categories.new.count += count;
        } else if (row.semantica === 'S' || statusName.includes('convert')) {
          categories.converted.count += count;
        } else if (row.semantica === 'F' || statusName.includes('junk') || statusName.includes('perdido')) {
          categories.lost.count += count;
        } else if (statusName.includes('qualificado') || statusName.includes('qualified')) {
          categories.qualified.count += count;
        } else {
          categories.inProgress.count += count;
        }
      });

      // Calcular percentuais progressivos
      if (totalLeads > 0) {
        categories.inProgress.percentage = ((totalLeads - categories.new.count) / totalLeads) * 100;
        categories.qualified.percentage = ((categories.qualified.count + categories.converted.count) / totalLeads) * 100;
        categories.converted.percentage = (categories.converted.count / totalLeads) * 100;
        categories.lost.percentage = (categories.lost.count / totalLeads) * 100;
      }

      // Formatar funil
      const funnel = [
        { stage: 'Leads Captados', count: totalLeads, percentage: 100 },
        { stage: 'Em Atendimento', count: categories.inProgress.count + categories.qualified.count + categories.converted.count, percentage: 0 },
        { stage: 'Qualificados', count: categories.qualified.count + categories.converted.count, percentage: 0 },
        { stage: 'Agendados', count: categories.converted.count, percentage: 0 },
      ];

      // Calcular percentuais do funil (relativo ao estágio anterior)
      for (let i = 1; i < funnel.length; i++) {
        funnel[i].percentage = funnel[i - 1].count > 0
          ? (funnel[i].count / funnel[i - 1].count) * 100
          : 0;
      }

      const duration = Date.now() - timer;
      logger.debug(`[DB] getAdvancedFunnel: ${totalLeads} leads em ${duration}ms`);

      return {
        funnel,
        categories,
        totalLeads,
        conversionRate: totalLeads > 0 ? (categories.converted.count / totalLeads) * 100 : 0,
        lossRate: totalLeads > 0 ? (categories.lost.count / totalLeads) * 100 : 0,
      };
    } catch (error) {
      logger.error('[DB] Erro em getAdvancedFunnel:', error.message);
      return {
        funnel: [],
        categories: {},
        totalLeads: 0,
        conversionRate: 0,
        lossRate: 0,
      };
    }
  }

  /**
   * Calcula atribuição de leads por campanha Bitrix com métricas avançadas
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} Dados de atribuição por campanha
   */
  async getCampaignAttribution(startDate, endDate) {
    const timer = Date.now();

    try {
      const result = await db.query(`
        SELECT
          l.custom_fields->>'UF_CRM_1729176132205' as campanha_id,
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE ls.semantica = 'S') as leads_convertidos,
          COUNT(*) FILTER (WHERE ls.semantica = 'F') as leads_perdidos,
          COUNT(*) FILTER (WHERE ls.semantica = 'P') as leads_em_andamento,
          SUM(COALESCE(l.opportunity, 0)) FILTER (WHERE ls.semantica = 'S') as valor_convertido
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY l.custom_fields->>'UF_CRM_1729176132205'
        ORDER BY COUNT(*) DESC
      `, [startDate, endDate]);

      const campaigns = result.rows.map(row => {
        const campanhaId = row.campanha_id || 'NAO_PREENCHIDO';
        const totalLeads = parseInt(row.total_leads) || 0;
        const convertedLeads = parseInt(row.leads_convertidos) || 0;
        const lostLeads = parseInt(row.leads_perdidos) || 0;
        const inProgressLeads = parseInt(row.leads_em_andamento) || 0;
        const convertedValue = parseFloat(row.valor_convertido) || 0;

        return {
          id: campanhaId,
          name: this.getCampanhaName(campanhaId === 'NAO_PREENCHIDO' ? null : campanhaId),
          totalLeads,
          convertedLeads,
          lostLeads,
          inProgressLeads,
          convertedValue,
          conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
          lossRate: totalLeads > 0 ? (lostLeads / totalLeads) * 100 : 0,
        };
      });

      // Calcular totais
      const totals = campaigns.reduce((acc, c) => {
        acc.totalLeads += c.totalLeads;
        acc.convertedLeads += c.convertedLeads;
        acc.lostLeads += c.lostLeads;
        acc.convertedValue += c.convertedValue;
        return acc;
      }, { totalLeads: 0, convertedLeads: 0, lostLeads: 0, convertedValue: 0 });

      const duration = Date.now() - timer;
      logger.debug(`[DB] getCampaignAttribution: ${campaigns.length} campanhas em ${duration}ms`);

      return {
        campaigns,
        totals: {
          ...totals,
          overallConversionRate: totals.totalLeads > 0
            ? (totals.convertedLeads / totals.totalLeads) * 100
            : 0,
          overallLossRate: totals.totalLeads > 0
            ? (totals.lostLeads / totals.totalLeads) * 100
            : 0,
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getCampaignAttribution:', error.message);
      return {
        campaigns: [],
        totals: { totalLeads: 0, convertedLeads: 0, lostLeads: 0, convertedValue: 0 },
      };
    }
  }

  /**
   * Mapeia ID de campanha Bitrix para nome
   */
  getCampanhaName(campanhaId) {
    const CAMPANHA_MAP = {
      '7358': 'Não veio por campanha',
      '3720': 'Depilação a Laser',
      '3722': 'Ultraforme',
      '3724': 'Quizena do Botox',
      '3726': 'Vem verão Crepaldi',
      '3728': 'Salamê Minguê Crepaldi',
      '3730': 'You Inside The Box',
      '7264': 'Plano Anual de Botox',
      '7266': 'Blefaroplastia',
      '7328': 'Day spa',
      '7300': 'Day Spa de Aniversario',
      '7316': 'Soft Lift',
      '7322': 'Limpeza de Pele',
      '7334': 'Elas no Campo',
      '7340': 'Volnewmer',
      '7346': 'Ultraforme III',
      '7352': 'Power Shape',
      '7364': 'Heccus',
      '7410': 'Fotona',
      '7416': 'Massagem Cranio Facial',
      '7418': 'Massagem com Pindas',
      '7420': 'Massagem Relaxante',
      '7466': 'Ventosa',
      '7422': 'Botox',
      '7424': 'Geral',
      '7472': 'Melasma',
      '7478': 'Zfield',
      '7688': 'Face Skin Koreano',
      '7700': 'Drenagem',
      '7702': 'Post Direcionando ao Whats',
      '7712': 'Pure Skin Ritual',
      '7718': 'Chikungunya',
      '7734': 'Avaliação Gratuita',
      '7736': 'Miofascial',
      '7756': 'Procedimento - Dr Paulo',
      '7758': 'Consulta - Dr Paulo',
      '7768': 'Protocolo Alto em Colageno',
      '7770': 'Protocolo Alto em Rejuvenescimento',
      '7772': 'Protocolo Alto em Firmeza',
      '7786': 'Protocolo Dia das Mães',
      '7788': 'Remoção de Tatuagem',
      '7790': 'Remarketing Blefaro',
      '7792': 'Venquish',
      '8026': 'Dia dos Namorados',
      '8202': 'Acido Hialuronico',
      '8204': 'Radiesse',
      '8206': 'Tratamento Orelha Rasgada',
      '8208': 'Rinomodelacao',
      '8286': 'Suspensão Elastica - Cuiabá + Raio',
      '8292': 'Suspensão Elastica - Cuiabá + Profissões',
      '8294': 'Suspensão Elastica - Outras Cidades',
      '8332': 'Avaliação Gratuita - Lipedema',
      '8348': 'Naturalidade',
      '8472': 'Ultraformer Face Pescoço - Black Friday',
      '8494': 'DEVILLE HOTEIS E TURISMO LTDA.',
      '8500': 'Depilação - Black Friday',
      '8524': 'Cartão Presente',
    };
    if (!campanhaId) return 'Não preenchido';
    return CAMPANHA_MAP[String(campanhaId)] || 'Não identificado';
  }

  /**
   * Busca funil de conversão com comparativo do período anterior
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} Dados do funil com comparativo
   */
  async getFunnelComparison(startDate, endDate) {
    const timer = Date.now();

    try {
      // Calcular período anterior de mesma duração
      const start = new Date(startDate);
      const end = new Date(endDate);
      const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - periodDays);
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // Buscar dados de ambos os períodos
      const [currentResult, previousResult] = await Promise.all([
        this.getFunnelDataForPeriod(startDate, endDate),
        this.getFunnelDataForPeriod(prevStartStr, prevEndStr),
      ]);

      // Calcular deltas
      const comparison = {
        current: currentResult,
        previous: previousResult,
        delta: {
          totalLeads: currentResult.totalLeads - previousResult.totalLeads,
          totalLeadsPercent: previousResult.totalLeads > 0
            ? ((currentResult.totalLeads - previousResult.totalLeads) / previousResult.totalLeads) * 100
            : 0,
          converted: currentResult.categories.converted.count - previousResult.categories.converted.count,
          convertedPercent: previousResult.categories.converted.count > 0
            ? ((currentResult.categories.converted.count - previousResult.categories.converted.count) / previousResult.categories.converted.count) * 100
            : 0,
          conversionRate: currentResult.conversionRate - previousResult.conversionRate,
        },
        periods: {
          current: { start: startDate, end: endDate },
          previous: { start: prevStartStr, end: prevEndStr },
        },
      };

      const duration = Date.now() - timer;
      logger.debug(`[DB] getFunnelComparison: ${duration}ms`);

      return comparison;
    } catch (error) {
      logger.error('[DB] Erro em getFunnelComparison:', error.message);
      return {
        current: { funnel: [], categories: {}, totalLeads: 0, conversionRate: 0 },
        previous: { funnel: [], categories: {}, totalLeads: 0, conversionRate: 0 },
        delta: { totalLeads: 0, totalLeadsPercent: 0, converted: 0, convertedPercent: 0, conversionRate: 0 },
        periods: { current: { start: startDate, end: endDate }, previous: {} },
      };
    }
  }

  /**
   * Helper para buscar dados do funil de um período específico
   */
  async getFunnelDataForPeriod(startDate, endDate) {
    const result = await db.query(`
      SELECT
        ls.nome as status_name,
        ls.semantica,
        ls.sort_order,
        COUNT(*) as count
      FROM leads l
      JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
      WHERE l.bitrix_created_at >= $1
        AND l.bitrix_created_at < ($2::date + interval '1 day')
      GROUP BY ls.nome, ls.semantica, ls.sort_order
      ORDER BY ls.sort_order
    `, [startDate, endDate]);

    const categories = {
      new: { label: 'Novos', count: 0, percentage: 100 },
      inProgress: { label: 'Em Andamento', count: 0, percentage: 0 },
      qualified: { label: 'Qualificados', count: 0, percentage: 0 },
      converted: { label: 'Convertidos', count: 0, percentage: 0 },
      lost: { label: 'Perdidos', count: 0, percentage: 0 },
    };

    const totalLeads = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);

    result.rows.forEach(row => {
      const count = parseInt(row.count);
      const statusName = (row.status_name || '').toLowerCase();

      if (statusName === 'novo' || statusName === 'new') {
        categories.new.count += count;
      } else if (row.semantica === 'S' || statusName.includes('convert')) {
        categories.converted.count += count;
      } else if (row.semantica === 'F' || statusName.includes('junk') || statusName.includes('perdid')) {
        categories.lost.count += count;
      } else if (statusName.includes('qualif')) {
        categories.qualified.count += count;
      } else {
        categories.inProgress.count += count;
      }
    });

    // Calcular percentuais
    Object.values(categories).forEach(cat => {
      cat.percentage = totalLeads > 0 ? Math.round((cat.count / totalLeads) * 1000) / 10 : 0;
    });

    const funnel = [
      { stage: 'Novos', count: categories.new.count, percentage: 100 },
      { stage: 'Em Andamento', count: categories.new.count + categories.inProgress.count, percentage: totalLeads > 0 ? ((categories.new.count + categories.inProgress.count) / totalLeads) * 100 : 0 },
      { stage: 'Qualificados', count: categories.qualified.count + categories.converted.count, percentage: totalLeads > 0 ? ((categories.qualified.count + categories.converted.count) / totalLeads) * 100 : 0 },
      { stage: 'Convertidos', count: categories.converted.count, percentage: totalLeads > 0 ? (categories.converted.count / totalLeads) * 100 : 0 },
    ];

    return {
      funnel,
      categories,
      totalLeads,
      conversionRate: totalLeads > 0 ? (categories.converted.count / totalLeads) * 100 : 0,
      lossRate: totalLeads > 0 ? (categories.lost.count / totalLeads) * 100 : 0,
    };
  }

  /**
   * Busca estatísticas de clientes recorrentes vs novos
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} Métricas de retenção
   */
  async getReturnCustomerStats(startDate, endDate) {
    const timer = Date.now();

    try {
      // Verificar se a coluna is_return_customer existe
      const columnCheck = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'leads'
        AND column_name = 'is_return_customer'
      `);

      if (columnCheck.rows.length === 0) {
        logger.warn('[DB] Coluna is_return_customer não existe, usando cálculo alternativo');
        return this.calculateReturnCustomerStatsAlternative(startDate, endDate);
      }

      // Buscar estatísticas de clientes recorrentes
      const result = await db.query(`
        SELECT
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE is_return_customer = TRUE) AS return_customer_leads,
          COUNT(*) FILTER (WHERE is_return_customer = FALSE OR is_return_customer IS NULL) AS new_customer_leads,
          COUNT(*) FILTER (WHERE status_id = 'CONVERTED' AND is_return_customer = TRUE) AS return_customer_converted,
          COUNT(*) FILTER (WHERE status_id = 'CONVERTED' AND (is_return_customer = FALSE OR is_return_customer IS NULL)) AS new_customer_converted
        FROM leads
        WHERE bitrix_created_at >= $1
          AND bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      const stats = result.rows[0];
      const totalLeads = parseInt(stats.total_leads) || 0;
      const returnCustomerLeads = parseInt(stats.return_customer_leads) || 0;
      const newCustomerLeads = parseInt(stats.new_customer_leads) || 0;
      const returnConverted = parseInt(stats.return_customer_converted) || 0;
      const newConverted = parseInt(stats.new_customer_converted) || 0;

      // Buscar tendência mensal
      const trendResult = await db.query(`
        SELECT
          DATE_TRUNC('month', bitrix_created_at) AS month,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE is_return_customer = TRUE) AS returning
        FROM leads
        WHERE bitrix_created_at >= $1
          AND bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY DATE_TRUNC('month', bitrix_created_at)
        ORDER BY month
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getReturnCustomerStats: ${duration}ms`);

      return {
        totalLeads,
        returnCustomerLeads,
        newCustomerLeads,
        returnCustomerRate: totalLeads > 0
          ? Math.round((returnCustomerLeads / totalLeads) * 1000) / 10
          : 0,
        returnCustomerConversionRate: returnCustomerLeads > 0
          ? Math.round((returnConverted / returnCustomerLeads) * 1000) / 10
          : 0,
        newCustomerConversionRate: newCustomerLeads > 0
          ? Math.round((newConverted / newCustomerLeads) * 1000) / 10
          : 0,
        monthlyTrend: trendResult.rows.map(r => ({
          month: r.month,
          total: parseInt(r.total),
          returning: parseInt(r.returning),
          rate: parseInt(r.total) > 0
            ? Math.round((parseInt(r.returning) / parseInt(r.total)) * 1000) / 10
            : 0,
        })),
      };
    } catch (error) {
      logger.error('[DB] Erro em getReturnCustomerStats:', error.message);
      return {
        totalLeads: 0,
        returnCustomerLeads: 0,
        newCustomerLeads: 0,
        returnCustomerRate: 0,
        returnCustomerConversionRate: 0,
        newCustomerConversionRate: 0,
        monthlyTrend: [],
      };
    }
  }

  /**
   * Cálculo alternativo de clientes recorrentes baseado em correlação de telefone/email
   * Usado quando a coluna is_return_customer não existe
   */
  async calculateReturnCustomerStatsAlternative(startDate, endDate) {
    const timer = Date.now();

    try {
      // Buscar leads com telefone que já existem em customer_analytics
      const result = await db.query(`
        WITH lead_customers AS (
          SELECT
            l.id,
            l.bitrix_id,
            l.status_id,
            EXISTS (
              SELECT 1 FROM customer_analytics ca
              WHERE ca.qtd_atendimentos > 0
              AND (
                ca.telefone IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(l.telefones) AS phone
                  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(ca.telefone, '[^0-9]', '', 'g')
                )
              )
            ) AS is_return_customer
          FROM leads l
          WHERE l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        )
        SELECT
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE is_return_customer = TRUE) AS return_customer_leads,
          COUNT(*) FILTER (WHERE is_return_customer = FALSE) AS new_customer_leads,
          COUNT(*) FILTER (WHERE status_id = 'CONVERTED' AND is_return_customer = TRUE) AS return_customer_converted,
          COUNT(*) FILTER (WHERE status_id = 'CONVERTED' AND is_return_customer = FALSE) AS new_customer_converted
        FROM lead_customers
      `, [startDate, endDate]);

      const stats = result.rows[0];
      const totalLeads = parseInt(stats.total_leads) || 0;
      const returnCustomerLeads = parseInt(stats.return_customer_leads) || 0;
      const newCustomerLeads = parseInt(stats.new_customer_leads) || 0;
      const returnConverted = parseInt(stats.return_customer_converted) || 0;
      const newConverted = parseInt(stats.new_customer_converted) || 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] calculateReturnCustomerStatsAlternative: ${duration}ms`);

      return {
        totalLeads,
        returnCustomerLeads,
        newCustomerLeads,
        returnCustomerRate: totalLeads > 0
          ? Math.round((returnCustomerLeads / totalLeads) * 1000) / 10
          : 0,
        returnCustomerConversionRate: returnCustomerLeads > 0
          ? Math.round((returnConverted / returnCustomerLeads) * 1000) / 10
          : 0,
        newCustomerConversionRate: newCustomerLeads > 0
          ? Math.round((newConverted / newCustomerLeads) * 1000) / 10
          : 0,
        monthlyTrend: [],
        note: 'Cálculo baseado em correlação de telefone',
      };
    } catch (error) {
      logger.error('[DB] Erro em calculateReturnCustomerStatsAlternative:', error.message);
      return {
        totalLeads: 0,
        returnCustomerLeads: 0,
        newCustomerLeads: 0,
        returnCustomerRate: 0,
        returnCustomerConversionRate: 0,
        newCustomerConversionRate: 0,
        monthlyTrend: [],
      };
    }
  }

  // ==================== NOVOS INDICADORES DA APRESENTAÇÃO ====================

  /**
   * Calcula Taxa de Retenção (90 dias) e Taxa de Resgate
   * Retenção: pacientes que retornaram dentro de 90 dias / total atendidos
   * Resgate: pacientes inativos contactados que retornaram / total contactados
   */
  async getRetentionAndRescueRates(startDate, endDate) {
    const timer = Date.now();

    try {
      // Taxa de Retenção 90 dias
      // Pacientes que foram atendidos no período e retornaram dentro de 90 dias
      const retentionResult = await db.query(`
        WITH atendidos_periodo AS (
          SELECT DISTINCT
            v.codcliente,
            MIN(v.data) as primeira_visita
          FROM vendas v
          WHERE v.data >= $1 AND v.data <= $2
          GROUP BY v.codcliente
        ),
        retornaram AS (
          SELECT DISTINCT
            ap.codcliente
          FROM atendidos_periodo ap
          JOIN vendas v2 ON ap.codcliente = v2.codcliente
          WHERE v2.data > ap.primeira_visita
            AND v2.data <= ap.primeira_visita + INTERVAL '90 days'
        )
        SELECT
          (SELECT COUNT(*) FROM atendidos_periodo) as total_atendidos,
          (SELECT COUNT(*) FROM retornaram) as retornaram_90_dias
      `, [startDate, endDate]);

      const retStats = retentionResult.rows[0];
      const totalAtendidos = parseInt(retStats?.total_atendidos) || 0;
      const retornaram90Dias = parseInt(retStats?.retornaram_90_dias) || 0;
      const taxaRetencao = totalAtendidos > 0
        ? Math.round((retornaram90Dias / totalAtendidos) * 1000) / 10
        : 0;

      // Taxa de Resgate - pacientes inativos que foram contactados e retornaram
      // Baseado na tabela pacientes_inativos_historico
      const rescueResult = await db.query(`
        SELECT
          COUNT(*) as total_contactados,
          COUNT(*) FILTER (WHERE data_reativacao IS NOT NULL) as reativados,
          COALESCE(SUM(valor_potencial), 0) as valor_potencial_total,
          COALESCE(SUM(valor_potencial) FILTER (WHERE data_reativacao IS NOT NULL), 0) as valor_resgatado
        FROM pacientes_inativos_historico
        WHERE data_contato >= $1 AND data_contato <= $2
      `, [startDate, endDate]);

      const rescStats = rescueResult.rows[0];
      const totalContactados = parseInt(rescStats?.total_contactados) || 0;
      const reativados = parseInt(rescStats?.reativados) || 0;
      const taxaResgate = totalContactados > 0
        ? Math.round((reativados / totalContactados) * 1000) / 10
        : 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] getRetentionAndRescueRates: ${duration}ms`);

      return {
        retencao: {
          totalAtendidos,
          retornaram90Dias,
          taxa: taxaRetencao,
          label: 'Taxa de Retenção (90 dias)',
        },
        resgate: {
          totalContactados,
          reativados,
          taxa: taxaResgate,
          valorPotencial: parseFloat(rescStats?.valor_potencial_total) || 0,
          valorResgatado: parseFloat(rescStats?.valor_resgatado) || 0,
          label: 'Taxa de Resgate',
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getRetentionAndRescueRates:', error.message);
      return {
        retencao: { totalAtendidos: 0, retornaram90Dias: 0, taxa: 0, label: 'Taxa de Retenção (90 dias)' },
        resgate: { totalContactados: 0, reativados: 0, taxa: 0, valorPotencial: 0, valorResgatado: 0, label: 'Taxa de Resgate' },
      };
    }
  }

  /**
   * Calcula Faturamento por Médico/Profissional
   * Quanto cada médico gera de receita por mês
   */
  async getFaturamentoPorMedico(startDate, endDate) {
    const timer = Date.now();

    try {
      const result = await db.query(`
        SELECT
          p.nome as medico,
          p.codprofissional,
          COUNT(DISTINCT v.codvenda) as total_atendimentos,
          COALESCE(SUM(vi.valor_total), 0) as faturamento,
          COALESCE(AVG(vi.valor_total), 0) as ticket_medio
        FROM vendas v
        JOIN vendas_itens vi ON v.codvenda = vi.codvenda
        LEFT JOIN profissionais p ON v.codprofissional = p.codprofissional
        WHERE v.data >= $1 AND v.data <= $2
          AND p.nome IS NOT NULL
          AND p.nome != ''
        GROUP BY p.codprofissional, p.nome
        ORDER BY faturamento DESC
        LIMIT 20
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getFaturamentoPorMedico: ${result.rows.length} médicos em ${duration}ms`);

      return result.rows.map(row => ({
        medico: row.medico,
        codprofissional: row.codprofissional,
        totalAtendimentos: parseInt(row.total_atendimentos) || 0,
        faturamento: parseFloat(row.faturamento) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoPorMedico:', error.message);
      return [];
    }
  }

  /**
   * Calcula Faturamento por Serviço/Categoria
   * Consultas, Programas de Acompanhamento, Protocolos, Implantes, Estética
   */
  async getFaturamentoPorServico(startDate, endDate) {
    const timer = Date.now();

    try {
      const result = await db.query(`
        SELECT
          CASE
            WHEN LOWER(vi.nome) LIKE '%consult%' THEN 'Consultas'
            WHEN LOWER(vi.nome) LIKE '%programa%' OR LOWER(vi.nome) LIKE '%acompanhamento%' THEN 'Programas de Acompanhamento'
            WHEN LOWER(vi.nome) LIKE '%protocol%' OR LOWER(vi.nome) LIKE '%im%' THEN 'Protocolos IM'
            WHEN LOWER(vi.nome) LIKE '%implant%' OR LOWER(vi.nome) LIKE '%hormon%' THEN 'Implantes Hormonais'
            WHEN LOWER(vi.nome) LIKE '%estetica%' OR LOWER(vi.nome) LIKE '%dermat%' OR LOWER(vi.nome) LIKE '%botox%' OR LOWER(vi.nome) LIKE '%peeling%' THEN 'Estética / Dermatologia'
            WHEN LOWER(vi.nome) LIKE '%laser%' OR LOWER(vi.nome) LIKE '%depila%' THEN 'Laser / Depilação'
            WHEN LOWER(vi.nome) LIKE '%massag%' OR LOWER(vi.nome) LIKE '%drenag%' OR LOWER(vi.nome) LIKE '%spa%' THEN 'SPA / Massagens'
            ELSE 'Outros'
          END as categoria,
          COUNT(*) as quantidade,
          COALESCE(SUM(vi.valor_total), 0) as faturamento
        FROM vendas v
        JOIN vendas_itens vi ON v.codvenda = vi.codvenda
        WHERE v.data >= $1 AND v.data <= $2
        GROUP BY categoria
        ORDER BY faturamento DESC
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getFaturamentoPorServico: ${result.rows.length} categorias em ${duration}ms`);

      return result.rows.map(row => ({
        categoria: row.categoria,
        quantidade: parseInt(row.quantidade) || 0,
        faturamento: parseFloat(row.faturamento) || 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getFaturamentoPorServico:', error.message);
      return [];
    }
  }

  /**
   * Calcula Ticket Médio de Consultas Novas vs Recorrentes
   * Novo: primeira compra do cliente
   * Recorrente: cliente que já comprou antes
   */
  async getTicketMedioNovosVsRecorrentes(startDate, endDate) {
    const timer = Date.now();

    try {
      const result = await db.query(`
        WITH primeira_compra AS (
          SELECT
            codcliente,
            MIN(data) as primeira_data
          FROM vendas
          GROUP BY codcliente
        ),
        vendas_classificadas AS (
          SELECT
            v.codvenda,
            v.codcliente,
            v.data,
            CASE
              WHEN v.data = pc.primeira_data THEN 'novo'
              ELSE 'recorrente'
            END as tipo_cliente
          FROM vendas v
          JOIN primeira_compra pc ON v.codcliente = pc.codcliente
          WHERE v.data >= $1 AND v.data <= $2
        )
        SELECT
          vc.tipo_cliente,
          COUNT(DISTINCT vc.codvenda) as total_vendas,
          COUNT(DISTINCT vc.codcliente) as total_clientes,
          COALESCE(SUM(vi.valor_total), 0) as faturamento,
          COALESCE(AVG(vi.valor_total), 0) as ticket_medio_item,
          COALESCE(SUM(vi.valor_total) / NULLIF(COUNT(DISTINCT vc.codvenda), 0), 0) as ticket_medio_venda
        FROM vendas_classificadas vc
        JOIN vendas_itens vi ON vc.codvenda = vi.codvenda
        GROUP BY vc.tipo_cliente
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getTicketMedioNovosVsRecorrentes: ${duration}ms`);

      const novos = result.rows.find(r => r.tipo_cliente === 'novo') || {};
      const recorrentes = result.rows.find(r => r.tipo_cliente === 'recorrente') || {};

      return {
        novos: {
          totalVendas: parseInt(novos.total_vendas) || 0,
          totalClientes: parseInt(novos.total_clientes) || 0,
          faturamento: parseFloat(novos.faturamento) || 0,
          ticketMedio: parseFloat(novos.ticket_medio_venda) || 0,
        },
        recorrentes: {
          totalVendas: parseInt(recorrentes.total_vendas) || 0,
          totalClientes: parseInt(recorrentes.total_clientes) || 0,
          faturamento: parseFloat(recorrentes.faturamento) || 0,
          ticketMedio: parseFloat(recorrentes.ticket_medio_venda) || 0,
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getTicketMedioNovosVsRecorrentes:', error.message);
      return {
        novos: { totalVendas: 0, totalClientes: 0, faturamento: 0, ticketMedio: 0 },
        recorrentes: { totalVendas: 0, totalClientes: 0, faturamento: 0, ticketMedio: 0 },
      };
    }
  }

  /**
   * Calcula Conversão por Canal (WhatsApp vs Ligação)
   * Baseado na origem do lead (SOURCE_ID ou UTM)
   */
  async getConversaoPorCanal(startDate, endDate) {
    const timer = Date.now();

    try {
      const result = await db.query(`
        SELECT
          CASE
            WHEN LOWER(COALESCE(source_nome, '')) LIKE '%whatsapp%'
              OR LOWER(COALESCE(utm_source, '')) LIKE '%whatsapp%'
              OR LOWER(COALESCE(utm_medium, '')) LIKE '%whatsapp%'
              THEN 'WhatsApp'
            WHEN LOWER(COALESCE(source_nome, '')) LIKE '%ligacao%'
              OR LOWER(COALESCE(source_nome, '')) LIKE '%ligação%'
              OR LOWER(COALESCE(source_nome, '')) LIKE '%telefone%'
              OR LOWER(COALESCE(source_nome, '')) LIKE '%call%'
              THEN 'Ligação'
            WHEN LOWER(COALESCE(utm_source, '')) LIKE '%instagram%'
              OR LOWER(COALESCE(utm_medium, '')) LIKE '%instagram%'
              THEN 'Instagram'
            WHEN LOWER(COALESCE(utm_source, '')) LIKE '%facebook%'
              OR LOWER(COALESCE(utm_medium, '')) LIKE '%facebook%'
              THEN 'Facebook'
            WHEN LOWER(COALESCE(utm_source, '')) LIKE '%google%'
              THEN 'Google'
            ELSE 'Outros'
          END as canal,
          COUNT(*) as total_mensagens,
          COUNT(*) FILTER (WHERE status_id = 'CONVERTED' OR status_semantica = 'success') as agendamentos,
          COUNT(DISTINCT CASE WHEN status_id = 'CONVERTED' OR status_semantica = 'success' THEN bitrix_id END) as leads_convertidos
        FROM leads l
        LEFT JOIN lead_sources ls ON l.source_id = ls.bitrix_source_id
        WHERE l.bitrix_created_at >= $1
          AND l.bitrix_created_at < ($2::date + interval '1 day')
        GROUP BY canal
        ORDER BY total_mensagens DESC
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getConversaoPorCanal: ${result.rows.length} canais em ${duration}ms`);

      return result.rows.map(row => ({
        canal: row.canal,
        totalMensagens: parseInt(row.total_mensagens) || 0,
        agendamentos: parseInt(row.agendamentos) || 0,
        taxaConversao: parseInt(row.total_mensagens) > 0
          ? Math.round((parseInt(row.agendamentos) / parseInt(row.total_mensagens)) * 1000) / 10
          : 0,
      }));
    } catch (error) {
      logger.error('[DB] Erro em getConversaoPorCanal:', error.message);
      return [];
    }
  }

  /**
   * Calcula Taxa de No-Show (faltas em consultas agendadas)
   * Baseado em agendamentos vs comparecimentos
   */
  async getTaxaNoShow(startDate, endDate) {
    const timer = Date.now();

    try {
      // No-show baseado em leads que foram CONVERTED (agendaram) mas não aparecem em vendas
      const result = await db.query(`
        WITH agendados AS (
          SELECT
            l.bitrix_id,
            l.nome,
            l.bitrix_created_at,
            l.telefones
          FROM leads l
          WHERE l.status_id = 'CONVERTED'
            AND l.bitrix_created_at >= $1
            AND l.bitrix_created_at < ($2::date + interval '1 day')
        ),
        compareceram AS (
          SELECT DISTINCT a.bitrix_id
          FROM agendados a
          JOIN clientes c ON (
            c.telefone IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(a.telefones) AS phone
              WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(c.telefone, '[^0-9]', '', 'g')
            )
          )
          JOIN vendas v ON v.codcliente = c.codcliente
          WHERE v.data >= $1 AND v.data <= ($2::date + interval '30 days')
        )
        SELECT
          (SELECT COUNT(*) FROM agendados) as total_agendados,
          (SELECT COUNT(*) FROM compareceram) as compareceram
      `, [startDate, endDate]);

      const stats = result.rows[0];
      const totalAgendados = parseInt(stats?.total_agendados) || 0;
      const compareceram = parseInt(stats?.compareceram) || 0;
      const faltas = Math.max(0, totalAgendados - compareceram);
      const taxaNoShow = totalAgendados > 0
        ? Math.round((faltas / totalAgendados) * 1000) / 10
        : 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] getTaxaNoShow: ${duration}ms`);

      return {
        totalAgendados,
        compareceram,
        faltas,
        taxaNoShow,
        impacto: {
          agendaFalsa: faltas,
          medicoOcioso: Math.round(faltas * 0.5), // Estimativa: 30min por consulta
          faturamentoPerdido: faltas * 350, // Estimativa média de consulta
        },
      };
    } catch (error) {
      logger.error('[DB] Erro em getTaxaNoShow:', error.message);
      return {
        totalAgendados: 0,
        compareceram: 0,
        faltas: 0,
        taxaNoShow: 0,
        impacto: { agendaFalsa: 0, medicoOcioso: 0, faturamentoPerdido: 0 },
      };
    }
  }

  /**
   * Calcula Taxa de Conversão de Propostas (Pós-consulta)
   * Quanto do que foi prescrito/orçado virou venda
   */
  async getTaxaConversaoPropostas(startDate, endDate) {
    const timer = Date.now();

    try {
      // Baseado em orçamentos vs vendas efetivadas
      // Se não houver tabela de orçamentos, usa deals como proxy
      const result = await db.query(`
        SELECT
          COUNT(DISTINCT d.bitrix_id) as total_propostas,
          COUNT(DISTINCT d.bitrix_id) FILTER (WHERE d.stage_id = 'WON' OR d.status_semantica = 'success') as propostas_fechadas,
          COALESCE(SUM(d.opportunity), 0) as valor_prescrito,
          COALESCE(SUM(d.opportunity) FILTER (WHERE d.stage_id = 'WON' OR d.status_semantica = 'success'), 0) as valor_vendido
        FROM deals d
        WHERE d.bitrix_created_at >= $1
          AND d.bitrix_created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]);

      const stats = result.rows[0];
      const totalPropostas = parseInt(stats?.total_propostas) || 0;
      const propostasFechadas = parseInt(stats?.propostas_fechadas) || 0;
      const valorPrescrito = parseFloat(stats?.valor_prescrito) || 0;
      const valorVendido = parseFloat(stats?.valor_vendido) || 0;

      const taxaConversao = totalPropostas > 0
        ? Math.round((propostasFechadas / totalPropostas) * 1000) / 10
        : 0;

      const taxaConversaoValor = valorPrescrito > 0
        ? Math.round((valorVendido / valorPrescrito) * 1000) / 10
        : 0;

      const duration = Date.now() - timer;
      logger.debug(`[DB] getTaxaConversaoPropostas: ${duration}ms`);

      return {
        totalPropostas,
        propostasFechadas,
        taxaConversao,
        valorPrescrito,
        valorVendido,
        taxaConversaoValor,
      };
    } catch (error) {
      logger.error('[DB] Erro em getTaxaConversaoPropostas:', error.message);
      return {
        totalPropostas: 0,
        propostasFechadas: 0,
        taxaConversao: 0,
        valorPrescrito: 0,
        valorVendido: 0,
        taxaConversaoValor: 0,
      };
    }
  }

  /**
   * Calcula CAC (Custo de Aquisição de Cliente) por Canal
   * CAC = Investimento no canal / Novos pacientes vindos do canal
   */
  async getCACPorCanal(startDate, endDate, investimentoPorCanal = {}) {
    const timer = Date.now();

    try {
      // Buscar novos pacientes por canal de origem
      const result = await db.query(`
        WITH novos_pacientes AS (
          SELECT
            v.codcliente,
            c.nome as cliente_nome,
            MIN(v.data) as primeira_compra
          FROM vendas v
          JOIN clientes c ON v.codcliente = c.codcliente
          GROUP BY v.codcliente, c.nome
          HAVING MIN(v.data) >= $1 AND MIN(v.data) <= $2
        ),
        pacientes_com_origem AS (
          SELECT
            np.codcliente,
            np.cliente_nome,
            np.primeira_compra,
            CASE
              WHEN l.utm_source ILIKE '%instagram%' OR l.utm_medium ILIKE '%instagram%' THEN 'Instagram Ads'
              WHEN l.utm_source ILIKE '%google%' THEN 'Google Ads'
              WHEN l.utm_source ILIKE '%facebook%' OR l.utm_medium ILIKE '%facebook%' THEN 'Facebook Ads'
              WHEN l.source_id IN ('CALL', 'PHONE') OR ls.nome ILIKE '%ligação%' THEN 'Ligação'
              WHEN ls.nome ILIKE '%indicação%' OR ls.nome ILIKE '%indicacao%' THEN 'Indicação'
              WHEN l.utm_source ILIKE '%influencer%' OR l.utm_campaign ILIKE '%influencer%' THEN 'Influencer'
              ELSE 'Outros'
            END as canal
          FROM novos_pacientes np
          LEFT JOIN clientes c ON np.codcliente = c.codcliente
          LEFT JOIN leads l ON (
            c.telefone IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(l.telefones) AS phone
              WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(c.telefone, '[^0-9]', '', 'g')
            )
          )
          LEFT JOIN lead_sources ls ON l.source_id = ls.bitrix_source_id
        )
        SELECT
          canal,
          COUNT(*) as novos_pacientes
        FROM pacientes_com_origem
        GROUP BY canal
        ORDER BY novos_pacientes DESC
      `, [startDate, endDate]);

      const duration = Date.now() - timer;
      logger.debug(`[DB] getCACPorCanal: ${result.rows.length} canais em ${duration}ms`);

      // Investimentos default (podem ser passados via parâmetro)
      const defaultInvestimentos = {
        'Instagram Ads': 18000,
        'Google Ads': 12000,
        'Facebook Ads': 8000,
        'Indicação': 3000,
        'Influencer': 5000,
        'Ligação': 2000,
        'Outros': 1000,
      };

      const investimentos = { ...defaultInvestimentos, ...investimentoPorCanal };

      return result.rows.map(row => {
        const investimento = investimentos[row.canal] || 0;
        const novosPacientes = parseInt(row.novos_pacientes) || 0;
        const cac = novosPacientes > 0 ? Math.round(investimento / novosPacientes) : 0;

        return {
          canal: row.canal,
          investimento,
          novosPacientes,
          cac,
        };
      });
    } catch (error) {
      logger.error('[DB] Erro em getCACPorCanal:', error.message);
      return [];
    }
  }
}

export const dashboardDBService = new DashboardDBService();
export default dashboardDBService;
