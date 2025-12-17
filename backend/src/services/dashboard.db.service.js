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

  // ==================== PACIENTES DO BANCO ====================

  /**
   * Busca analytics de pacientes do banco de dados (contas_receber)
   * Usa raw_data->>'nome_cliente' para obter o nome real
   */
  async getPacientesAnalyticsFromDB(startDate, endDate, estabelecimentosFiltro = []) {
    try {
      const timer = Date.now();

      // Query para buscar faturamento por cliente
      let query = `
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

      const params = [startDate, endDate];

      if (estabelecimentosFiltro.length > 0) {
        query += ` AND cod_estab = ANY($3)`;
        params.push(estabelecimentosFiltro);
      }

      query += `
          GROUP BY cod_cliente, raw_data->>'nome_cliente'
        )
        SELECT
          cod_cliente,
          COALESCE(nome_cliente, 'Cliente ' || cod_cliente) as cliente,
          quantidade_vendas as "quantidadeVendas",
          ROUND(investimento::numeric, 2) as investimento,
          ultima_compra,
          EXTRACT(DAY FROM NOW() - ultima_compra)::integer as dias_sem_vir
        FROM cliente_stats
        WHERE nome_cliente IS NOT NULL AND nome_cliente != ''
        ORDER BY investimento DESC
      `;

      const result = await db.query(query, params);

      // Separar em categorias
      const faturamentoPaciente = [];
      const potenciaisMais4Meses = [];
      const potenciaisMenos4Meses = [];

      result.rows.forEach(row => {
        const paciente = {
          cliente: row.cliente,
          clienteId: row.cod_cliente,
          quantidadeVendas: parseInt(row.quantidadeVendas) || 0,
          investimento: parseFloat(row.investimento) || 0,
        };

        faturamentoPaciente.push(paciente);

        const diasSemVir = parseInt(row.dias_sem_vir) || 0;

        if (diasSemVir > 120) {
          potenciaisMais4Meses.push({
            ...paciente,
            diasSemVir,
          });
        } else if (diasSemVir > 30) {
          potenciaisMenos4Meses.push({
            ...paciente,
            diasSemVir,
          });
        }
      });

      // Ordenar potenciais por dias sem vir
      potenciaisMais4Meses.sort((a, b) => b.diasSemVir - a.diasSemVir);
      potenciaisMenos4Meses.sort((a, b) => b.diasSemVir - a.diasSemVir);

      logger.debug(`[DB] getPacientesAnalyticsFromDB: ${faturamentoPaciente.length} clientes em ${Date.now() - timer}ms`);

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
   */
  getMotivoDesqualificacaoName(motivoId) {
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
    return MOTIVO_DESQUALIFICACAO_MAP[String(motivoId)] || 'Não identificado';
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
   * Busca motivos de desqualificação baseado na data de MODIFICAÇÃO do lead
   * (quando o lead foi efetivamente desqualificado), não na data de criação
   * @param {string} startDate - Data início (yyyy-MM-dd)
   * @param {string} endDate - Data fim (yyyy-MM-dd)
   */
  async getMotivosDesqualificacao(startDate, endDate) {
    const timer = Date.now();

    try {
      // Busca leads desqualificados no período pela data de MODIFICAÇÃO
      // Isso captura leads que foram desqualificados neste período,
      // independente de quando foram criados
      const result = await db.query(`
        SELECT
          l.custom_fields->>'UF_CRM_1695041103' as motivo_id,
          COUNT(*) as count
        FROM leads l
        WHERE l.status_id = 'JUNK'
          AND l.bitrix_modified_at >= $1
          AND l.bitrix_modified_at < ($2::date + interval '1 day')
        GROUP BY l.custom_fields->>'UF_CRM_1695041103'
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
}

export const dashboardDBService = new DashboardDBService();
export default dashboardDBService;
