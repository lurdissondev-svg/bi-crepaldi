import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import db from '../database/index.js';
import config from '../config/index.js';
import logger, { startTimer, logDataInconsistency } from '../utils/logger.js';
import bitrix24Service from './bitrix24.service.js';
import belleService from './belle.service.js';
import { normalizePhone, normalizeEmail } from '../validators/dataValidator.js';

/**
 * Serviço de Sincronização
 * Responsável por sincronizar dados do Bitrix24 e Belle Software
 * com o banco de dados PostgreSQL a cada 5 minutos.
 */
class SyncService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.syncQueue = [];
  }

  // ==================== CONTROLE DO JOB ====================

  /**
   * Inicia o job de sincronização
   */
  start() {
    if (this.intervalId) {
      logger.warn('Sync job já está rodando');
      return;
    }

    const intervalMs = config.sync.intervalMinutes * 60 * 1000;

    logger.info(`Iniciando sync job a cada ${config.sync.intervalMinutes} minutos`);

    // Executa imediatamente na primeira vez
    this.runFullSync();

    // Configura o intervalo
    this.intervalId = setInterval(() => {
      this.runFullSync();
    }, intervalMs);
  }

  /**
   * Para o job de sincronização
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Sync job parado');
    }
  }

  /**
   * Executa sincronização completa
   */
  async runFullSync() {
    if (this.isRunning) {
      logger.warn('Sync já em execução, pulando...');
      return;
    }

    this.isRunning = true;
    const timer = startTimer('Full Sync');

    try {
      logger.info('=== Iniciando sincronização completa ===');

      // Sync Bitrix24 (CRM)
      await this.syncBitrixData();

      // Sync Belle Software (Financeiro)
      await this.syncBelleData();

      // Correlação Lead -> Venda
      await this.runCorrelation();

      // Agregações
      await this.updateAggregations();

      timer({ status: 'success' });
      logger.info('=== Sincronização completa finalizada ===');

    } catch (error) {
      logger.error('Erro na sincronização completa:', error);
      timer({ status: 'error', error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  // ==================== SYNC BITRIX24 ====================

  async syncBitrixData() {
    const timer = startTimer('Bitrix24 Sync');

    try {
      // Sync em paralelo das entidades independentes
      await Promise.all([
        this.syncLeadStatuses(),
        this.syncLeadSources(),
        this.syncDealStages(),
      ]);

      // Sync leads e deals (dependem dos status/stages)
      await Promise.all([
        this.syncLeads(),
        this.syncDeals(),
      ]);

      timer({ status: 'success' });
    } catch (error) {
      logger.error('Erro no sync Bitrix24:', error);
      timer({ status: 'error' });
      throw error;
    }
  }

  async syncLeadStatuses() {
    const logId = await this.startSyncLog('lead_statuses', 'full_sync');

    try {
      const statuses = await bitrix24Service.getLeadStatuses();

      const records = statuses.map(s => ({
        bitrix_status_id: s.STATUS_ID,
        nome: s.NAME,
        sort_order: parseInt(s.SORT) || 0,
        semantica: s.EXTRA?.SEMANTICS || s.STATUS_SEMANTIC_ID || 'P',
        cor: s.EXTRA?.COLOR || null,
      }));

      const result = await this.upsertRecords('lead_statuses', records, 'bitrix_status_id', ['nome', 'sort_order', 'semantica', 'cor']);

      await this.finishSyncLog(logId, 'success', {
        records_fetched: statuses.length,
        ...result,
      });

      logger.debug(`Lead statuses sincronizados: ${statuses.length}`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncLeadSources() {
    const logId = await this.startSyncLog('lead_sources', 'full_sync');

    try {
      const sources = await bitrix24Service.getLeadSources();

      const records = sources.map(s => ({
        bitrix_source_id: s.STATUS_ID,
        nome: s.NAME,
        sort_order: parseInt(s.SORT) || 0,
      }));

      const result = await this.upsertRecords('lead_sources', records, 'bitrix_source_id', ['nome', 'sort_order']);

      await this.finishSyncLog(logId, 'success', {
        records_fetched: sources.length,
        ...result,
      });

      logger.debug(`Lead sources sincronizados: ${sources.length}`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncDealStages() {
    const logId = await this.startSyncLog('deal_stages', 'full_sync');

    try {
      const stages = await bitrix24Service.getDealStages();

      const records = stages.map(s => ({
        bitrix_stage_id: s.STATUS_ID,
        category_id: 0,
        nome: s.NAME,
        sort_order: parseInt(s.SORT) || 0,
        semantica: s.EXTRA?.SEMANTICS || 'P',
        cor: s.EXTRA?.COLOR || null,
      }));

      const result = await this.upsertRecords('deal_stages', records, 'bitrix_stage_id', ['nome', 'sort_order', 'semantica', 'cor']);

      await this.finishSyncLog(logId, 'success', {
        records_fetched: stages.length,
        ...result,
      });

      logger.debug(`Deal stages sincronizados: ${stages.length}`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncLeads() {
    const logId = await this.startSyncLog('leads', 'full_sync');

    try {
      // Busca leads dos últimos 90 dias
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      const leads = await bitrix24Service.getLeadsByDateRange(startDate, endDate);

      const records = leads.map(lead => ({
        bitrix_id: parseInt(lead.ID),
        titulo: lead.TITLE || null,
        nome: lead.NAME || null,
        sobrenome: lead.LAST_NAME || null,
        status_id: lead.STATUS_ID || null,
        source_id: lead.SOURCE_ID || null,
        source_description: lead.SOURCE_DESCRIPTION || null,
        telefones: JSON.stringify(this.extractPhones(lead)),
        emails: JSON.stringify(this.extractEmails(lead)),
        empresa: lead.COMPANY_TITLE || null,
        utm_source: lead.UTM_SOURCE || null,
        utm_medium: lead.UTM_MEDIUM || null,
        utm_campaign: lead.UTM_CAMPAIGN || null,
        utm_content: lead.UTM_CONTENT || null,
        utm_term: lead.UTM_TERM || null,
        opportunity: parseFloat(lead.OPPORTUNITY) || 0,
        currency_id: lead.CURRENCY_ID || 'BRL',
        assigned_by_id: parseInt(lead.ASSIGNED_BY_ID) || null,
        bitrix_created_at: lead.DATE_CREATE || null,
        bitrix_modified_at: lead.DATE_MODIFY || null,
        bitrix_closed_at: lead.DATE_CLOSED || null,
        custom_fields: JSON.stringify(this.extractCustomFields(lead)),
        synced_at: new Date().toISOString(),
      }));

      const result = await this.upsertRecords('leads', records, 'bitrix_id', [
        'titulo', 'nome', 'sobrenome', 'status_id', 'source_id', 'source_description',
        'telefones', 'emails', 'empresa', 'utm_source', 'utm_medium', 'utm_campaign',
        'utm_content', 'utm_term', 'opportunity', 'currency_id', 'assigned_by_id',
        'bitrix_created_at', 'bitrix_modified_at', 'bitrix_closed_at', 'custom_fields', 'synced_at'
      ]);

      await this.finishSyncLog(logId, 'success', {
        records_fetched: leads.length,
        date_from: startDate,
        date_to: endDate,
        ...result,
      });

      logger.info(`Leads sincronizados: ${leads.length} (${result.inserted} novos, ${result.updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncDeals() {
    const logId = await this.startSyncLog('deals', 'full_sync');

    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      const deals = await bitrix24Service.getDealsByDateRange(startDate, endDate);

      const records = deals.map(deal => ({
        bitrix_id: parseInt(deal.ID),
        titulo: deal.TITLE || null,
        stage_id: deal.STAGE_ID || null,
        category_id: parseInt(deal.CATEGORY_ID) || 0,
        opportunity: parseFloat(deal.OPPORTUNITY) || 0,
        currency_id: deal.CURRENCY_ID || 'BRL',
        contact_id: parseInt(deal.CONTACT_ID) || null,
        company_id: parseInt(deal.COMPANY_ID) || null,
        source_id: deal.SOURCE_ID || null,
        assigned_by_id: parseInt(deal.ASSIGNED_BY_ID) || null,
        utm_source: deal.UTM_SOURCE || null,
        utm_medium: deal.UTM_MEDIUM || null,
        utm_campaign: deal.UTM_CAMPAIGN || null,
        utm_content: deal.UTM_CONTENT || null,
        utm_term: deal.UTM_TERM || null,
        bitrix_created_at: deal.DATE_CREATE || null,
        bitrix_modified_at: deal.DATE_MODIFY || null,
        close_date: deal.CLOSEDATE || null,
        custom_fields: JSON.stringify(this.extractCustomFields(deal)),
        synced_at: new Date().toISOString(),
      }));

      const result = await this.upsertRecords('deals', records, 'bitrix_id', [
        'titulo', 'stage_id', 'category_id', 'opportunity', 'currency_id',
        'contact_id', 'company_id', 'source_id', 'assigned_by_id',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'bitrix_created_at', 'bitrix_modified_at', 'close_date', 'custom_fields', 'synced_at'
      ]);

      await this.finishSyncLog(logId, 'success', {
        records_fetched: deals.length,
        date_from: startDate,
        date_to: endDate,
        ...result,
      });

      logger.info(`Deals sincronizados: ${deals.length} (${result.inserted} novos, ${result.updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  // ==================== SYNC BELLE SOFTWARE ====================

  async syncBelleData() {
    const timer = startTimer('Belle Software Sync');

    try {
      // Sync contas a receber (faturamento)
      await this.syncContasReceber();

      // Sync vendas
      await this.syncVendas();

      timer({ status: 'success' });
    } catch (error) {
      logger.error('Erro no sync Belle:', error);
      timer({ status: 'error' });
      throw error;
    }
  }

  async syncContasReceber() {
    const logId = await this.startSyncLog('contas_receber', 'full_sync');

    try {
      // Período: último mês + mês atual
      const hoje = new Date();
      const inicioMesAnterior = format(startOfMonth(subDays(hoje, 30)), 'yyyy-MM-dd');
      const fimMesAtual = format(endOfMonth(hoje), 'yyyy-MM-dd');

      const dados = await belleService.getContasReceberTodos(inicioMesAnterior, fimMesAtual, 'lancamento');

      if (!Array.isArray(dados)) {
        logger.warn('Contas a receber retornou formato inválido');
        return;
      }

      const records = dados.map(conta => ({
        cod_conta: parseInt(conta.cod_conta) || 0,
        cod_estab: parseInt(conta.cod_estabelecimento) || 1,
        cod_cliente: parseInt(conta.cod_cliente) || null,
        cod_venda: parseInt(conta.cod_venda) || null,
        valor_bruto: parseFloat(conta.valor_bruto) || 0,
        valor_liquido: parseFloat(conta.valor_liquido) || 0,
        valor_pago: parseFloat(conta.valor_pago) || 0,
        cod_forma_pagamento: parseInt(conta.cod_forma_pagamento) || null,
        nome_forma_pagamento: conta.nome_forma_pagamento || null,
        dt_lancamento: this.parseBelleDate(conta.dt_lancamento),
        dt_vencimento: this.parseBelleDate(conta.dt_vencimento),
        dt_pagamento: this.parseBelleDate(conta.dt_pagamento),
        confirmado: conta.confirmado || 'N',
        status: conta.status || null,
        raw_data: JSON.stringify(conta),
        synced_at: new Date().toISOString(),
      })).filter(r => r.cod_conta > 0);

      // Agrupa por cod_estab para upsert
      const uniqueRecords = this.deduplicateByKeys(records, ['cod_conta', 'cod_estab']);

      let inserted = 0;
      let updated = 0;

      // Insere em batches de 500
      for (let i = 0; i < uniqueRecords.length; i += 500) {
        const batch = uniqueRecords.slice(i, i + 500);
        const result = await this.upsertContasReceber(batch);
        inserted += result.inserted;
        updated += result.updated;
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: dados.length,
        records_inserted: inserted,
        records_updated: updated,
        date_from: inicioMesAnterior,
        date_to: fimMesAtual,
      });

      logger.info(`Contas a receber sincronizadas: ${dados.length} (${inserted} novos, ${updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncVendas() {
    const logId = await this.startSyncLog('vendas', 'full_sync');

    try {
      const hoje = new Date();
      const inicioMesAnterior = format(startOfMonth(subDays(hoje, 30)), 'yyyy-MM-dd');
      const fimMesAtual = format(endOfMonth(hoje), 'yyyy-MM-dd');

      const resultados = await belleService.getVendasTodosEstabelecimentos(inicioMesAnterior, fimMesAtual);

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      for (const resultado of resultados) {
        const vendas = resultado.data || [];
        totalFetched += vendas.length;

        const records = vendas.map(venda => ({
          cod_venda: parseInt(venda.cod_venda) || 0,
          cod_estab: resultado.codestab,
          cod_cliente: parseInt(venda.cod_cliente) || null,
          valor_venda: parseFloat(venda.valor_venda) || 0,
          valor_desconto: parseFloat(venda.valor_desconto) || 0,
          valor_liquido: parseFloat(venda.valor_liquido) || 0,
          data_venda: venda.data_venda || null,
          cod_profissional: parseInt(venda.cod_profissional) || null,
          nome_profissional: venda.nome_profissional || null,
          status: venda.status || null,
          confirmado: venda.confirmado || 'N',
          raw_data: JSON.stringify(venda),
          synced_at: new Date().toISOString(),
        })).filter(r => r.cod_venda > 0);

        const uniqueRecords = this.deduplicateByKeys(records, ['cod_venda', 'cod_estab']);

        for (let i = 0; i < uniqueRecords.length; i += 500) {
          const batch = uniqueRecords.slice(i, i + 500);
          const result = await this.upsertVendas(batch);
          inserted += result.inserted;
          updated += result.updated;
        }
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: totalFetched,
        records_inserted: inserted,
        records_updated: updated,
        date_from: inicioMesAnterior,
        date_to: fimMesAtual,
      });

      logger.info(`Vendas sincronizadas: ${totalFetched} (${inserted} novos, ${updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  // ==================== CORRELAÇÃO LEAD -> VENDA ====================

  async runCorrelation() {
    const logId = await this.startSyncLog('correlations', 'correlation');
    const timer = startTimer('Lead-Sale Correlation');

    try {
      // Busca leads sem correlação dos últimos 90 dias
      const leadsQuery = `
        SELECT l.id, l.bitrix_id, l.telefones, l.emails, l.bitrix_created_at
        FROM leads l
        LEFT JOIN lead_sale_correlations lsc ON l.id = lsc.lead_id
        WHERE lsc.id IS NULL
          AND l.bitrix_created_at >= NOW() - INTERVAL '90 days'
        LIMIT 1000
      `;

      const leadsResult = await db.query(leadsQuery);
      const leads = leadsResult.rows;

      if (leads.length === 0) {
        await this.finishSyncLog(logId, 'success', { records_fetched: 0 });
        return;
      }

      // Busca vendas dos últimos 90 dias para matching
      const vendasQuery = `
        SELECT v.id, v.cod_venda, v.data_venda, v.valor_venda, c.telefone, c.celular, c.email
        FROM vendas v
        LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente AND v.cod_estab = c.cod_estab
        WHERE v.data_venda >= NOW() - INTERVAL '90 days'
          AND v.confirmado = 'S'
      `;

      const vendasResult = await db.query(vendasQuery);
      const vendas = vendasResult.rows;

      let correlationsFound = 0;

      for (const lead of leads) {
        const leadPhones = this.extractNormalizedPhones(lead.telefones);
        const leadEmails = this.extractNormalizedEmails(lead.emails);

        for (const venda of vendas) {
          const vendaPhone = normalizePhone(venda.telefone || venda.celular || '');
          const vendaEmail = normalizeEmail(venda.email || '');

          let matched = false;
          let matchedBy = null;
          let confidence = 0;

          // Tenta match por telefone
          for (const phone of leadPhones) {
            if (phone === vendaPhone) {
              matched = true;
              matchedBy = 'phone';
              confidence = 1.0;
              break;
            }
            if (phone.slice(-8) === vendaPhone.slice(-8) && vendaPhone.length >= 8) {
              matched = true;
              matchedBy = 'phone_partial';
              confidence = 0.85;
              break;
            }
          }

          // Tenta match por email se não achou por telefone
          if (!matched && vendaEmail.includes('@')) {
            for (const email of leadEmails) {
              if (email === vendaEmail) {
                matched = true;
                matchedBy = 'email';
                confidence = 0.9;
                break;
              }
            }
          }

          if (matched) {
            const daysToConvert = venda.data_venda && lead.bitrix_created_at
              ? Math.floor((new Date(venda.data_venda) - new Date(lead.bitrix_created_at)) / (1000 * 60 * 60 * 24))
              : null;

            await db.query(`
              INSERT INTO lead_sale_correlations
                (lead_id, venda_id, matched_by, match_confidence, revenue, lead_date, sale_date, days_to_convert)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (lead_id, venda_id) DO NOTHING
            `, [
              lead.id,
              venda.id,
              matchedBy,
              confidence,
              venda.valor_venda || 0,
              lead.bitrix_created_at,
              venda.data_venda,
              daysToConvert
            ]);

            correlationsFound++;
            break; // Um lead pode ter apenas uma correlação
          }
        }
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: leads.length,
        records_inserted: correlationsFound,
      });

      timer({ correlationsFound });
      logger.info(`Correlações encontradas: ${correlationsFound} de ${leads.length} leads analisados`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      timer({ status: 'error' });
      throw error;
    }
  }

  // ==================== AGREGAÇÕES ====================

  async updateAggregations() {
    const timer = startTimer('Aggregations Update');

    try {
      await Promise.all([
        this.updateFaturamentoDiario(),
        this.updateLeadsDiario(),
      ]);

      timer({ status: 'success' });
    } catch (error) {
      logger.error('Erro nas agregações:', error);
      timer({ status: 'error' });
    }
  }

  async updateFaturamentoDiario() {
    const query = `
      INSERT INTO faturamento_diario (data_referencia, cod_estab, valor_total, quantidade_movimentos, ticket_medio, por_forma_pagamento, calculated_at)
      SELECT
        dt_lancamento as data_referencia,
        cod_estab,
        SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) as valor_total,
        COUNT(CASE WHEN confirmado = 'S' THEN 1 END) as quantidade_movimentos,
        ROUND(AVG(CASE WHEN confirmado = 'S' THEN valor_bruto END), 2) as ticket_medio,
        COALESCE(
          jsonb_object_agg(
            COALESCE(nome_forma_pagamento, 'Outros'),
            jsonb_build_object('valor', forma_valor, 'quantidade', forma_qtd)
          ) FILTER (WHERE forma_valor IS NOT NULL),
          '{}'::jsonb
        ) as por_forma_pagamento,
        NOW() as calculated_at
      FROM (
        SELECT
          dt_lancamento,
          cod_estab,
          confirmado,
          valor_bruto,
          nome_forma_pagamento,
          SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) OVER (PARTITION BY dt_lancamento, cod_estab, nome_forma_pagamento) as forma_valor,
          COUNT(CASE WHEN confirmado = 'S' THEN 1 END) OVER (PARTITION BY dt_lancamento, cod_estab, nome_forma_pagamento) as forma_qtd
        FROM contas_receber
        WHERE dt_lancamento >= CURRENT_DATE - INTERVAL '60 days'
      ) sub
      WHERE dt_lancamento IS NOT NULL
      GROUP BY dt_lancamento, cod_estab
      ON CONFLICT (data_referencia, cod_estab)
      DO UPDATE SET
        valor_total = EXCLUDED.valor_total,
        quantidade_movimentos = EXCLUDED.quantidade_movimentos,
        ticket_medio = EXCLUDED.ticket_medio,
        por_forma_pagamento = EXCLUDED.por_forma_pagamento,
        calculated_at = NOW()
    `;

    await db.query(query);
    logger.debug('Faturamento diário atualizado');
  }

  async updateLeadsDiario() {
    const query = `
      WITH base_leads AS (
        SELECT
          DATE(l.bitrix_created_at) as data_ref,
          l.source_id,
          l.utm_source,
          EXTRACT(HOUR FROM l.bitrix_created_at)::int as hora,
          ls.semantica,
          l.status_id
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.status_id = ls.bitrix_status_id
        WHERE l.bitrix_created_at >= CURRENT_DATE - INTERVAL '60 days'
          AND l.bitrix_created_at IS NOT NULL
      ),
      totais AS (
        SELECT
          data_ref,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN semantica IS NULL OR status_id = 'NEW' THEN 1 END) as leads_novos,
          COUNT(CASE WHEN semantica = 'P' AND status_id != 'NEW' THEN 1 END) as leads_em_andamento,
          COUNT(CASE WHEN semantica = 'S' THEN 1 END) as leads_convertidos,
          COUNT(CASE WHEN semantica = 'F' THEN 1 END) as leads_perdidos
        FROM base_leads
        GROUP BY data_ref
      ),
      por_fonte AS (
        SELECT
          data_ref,
          COALESCE(
            jsonb_object_agg(COALESCE(source_id, 'unknown'), cnt),
            '{}'::jsonb
          ) as por_fonte
        FROM (
          SELECT data_ref, source_id, COUNT(*) as cnt
          FROM base_leads
          WHERE source_id IS NOT NULL
          GROUP BY data_ref, source_id
        ) sub
        GROUP BY data_ref
      ),
      por_utm AS (
        SELECT
          data_ref,
          COALESCE(
            jsonb_object_agg(COALESCE(utm_source, 'direct'), cnt),
            '{}'::jsonb
          ) as por_utm_source
        FROM (
          SELECT data_ref, utm_source, COUNT(*) as cnt
          FROM base_leads
          WHERE utm_source IS NOT NULL
          GROUP BY data_ref, utm_source
        ) sub
        GROUP BY data_ref
      ),
      por_hora AS (
        SELECT
          data_ref,
          jsonb_object_agg(hora::text, cnt) as por_hora
        FROM (
          SELECT data_ref, hora, COUNT(*) as cnt
          FROM base_leads
          GROUP BY data_ref, hora
        ) sub
        GROUP BY data_ref
      )
      INSERT INTO leads_diario (data_referencia, total_leads, leads_novos, leads_em_andamento, leads_convertidos, leads_perdidos, por_fonte, por_utm_source, por_hora, calculated_at)
      SELECT
        t.data_ref,
        t.total_leads,
        t.leads_novos,
        t.leads_em_andamento,
        t.leads_convertidos,
        t.leads_perdidos,
        COALESCE(f.por_fonte, '{}'::jsonb),
        COALESCE(u.por_utm_source, '{}'::jsonb),
        COALESCE(h.por_hora, '{}'::jsonb),
        NOW()
      FROM totais t
      LEFT JOIN por_fonte f ON t.data_ref = f.data_ref
      LEFT JOIN por_utm u ON t.data_ref = u.data_ref
      LEFT JOIN por_hora h ON t.data_ref = h.data_ref
      ON CONFLICT (data_referencia)
      DO UPDATE SET
        total_leads = EXCLUDED.total_leads,
        leads_novos = EXCLUDED.leads_novos,
        leads_em_andamento = EXCLUDED.leads_em_andamento,
        leads_convertidos = EXCLUDED.leads_convertidos,
        leads_perdidos = EXCLUDED.leads_perdidos,
        por_fonte = EXCLUDED.por_fonte,
        por_utm_source = EXCLUDED.por_utm_source,
        por_hora = EXCLUDED.por_hora,
        calculated_at = NOW()
    `;

    await db.query(query);
    logger.debug('Leads diário atualizado');
  }

  // ==================== HELPERS ====================

  async startSyncLog(entityType, operation) {
    const result = await db.query(`
      INSERT INTO sync_logs (entity_type, operation, status, started_at)
      VALUES ($1, $2, 'running', NOW())
      RETURNING id
    `, [entityType, operation]);

    return result.rows[0].id;
  }

  async finishSyncLog(logId, status, metrics = {}, errorMessage = null) {
    await db.query(`
      UPDATE sync_logs SET
        status = $1,
        records_fetched = $2,
        records_inserted = $3,
        records_updated = $4,
        records_error = $5,
        date_from = $6,
        date_to = $7,
        finished_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        error_message = $8
      WHERE id = $9
    `, [
      status,
      metrics.records_fetched || 0,
      metrics.records_inserted || metrics.inserted || 0,
      metrics.records_updated || metrics.updated || 0,
      metrics.records_error || 0,
      metrics.date_from || null,
      metrics.date_to || null,
      errorMessage,
      logId
    ]);

    // Atualiza sync_status
    await db.query(`
      UPDATE sync_status SET
        last_sync_at = NOW(),
        last_sync_status = $1,
        last_sync_log_id = $2,
        next_sync_at = NOW() + (sync_interval_minutes || ' minutes')::interval
      WHERE entity_type = (SELECT entity_type FROM sync_logs WHERE id = $2)
    `, [status, logId]);
  }

  async upsertRecords(table, records, conflictColumn, updateColumns) {
    if (!records || records.length === 0) return { inserted: 0, updated: 0 };

    let totalInserted = 0;
    let totalUpdated = 0;
    const batchSize = 100; // Processa em lotes de 100 para evitar limite de parâmetros

    try {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const result = await db.upsertMany(table, batch, conflictColumn, updateColumns);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
      }
      return { inserted: totalInserted, updated: totalUpdated };
    } catch (error) {
      logger.error(`Erro no upsert ${table}:`, error.message);
      return { inserted: totalInserted, updated: totalUpdated };
    }
  }

  async upsertContasReceber(records) {
    if (!records || records.length === 0) return { inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      try {
        const result = await db.query(`
          INSERT INTO contas_receber (cod_conta, cod_estab, cod_cliente, cod_venda, valor_bruto, valor_liquido, valor_pago, cod_forma_pagamento, nome_forma_pagamento, dt_lancamento, dt_vencimento, dt_pagamento, confirmado, status, raw_data, synced_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (cod_conta, cod_estab)
          DO UPDATE SET
            valor_bruto = EXCLUDED.valor_bruto,
            valor_liquido = EXCLUDED.valor_liquido,
            valor_pago = EXCLUDED.valor_pago,
            nome_forma_pagamento = EXCLUDED.nome_forma_pagamento,
            dt_lancamento = EXCLUDED.dt_lancamento,
            confirmado = EXCLUDED.confirmado,
            raw_data = EXCLUDED.raw_data,
            synced_at = EXCLUDED.synced_at
          RETURNING (xmax = 0) AS is_insert
        `, [
          record.cod_conta, record.cod_estab, record.cod_cliente, record.cod_venda,
          record.valor_bruto, record.valor_liquido, record.valor_pago,
          record.cod_forma_pagamento, record.nome_forma_pagamento,
          record.dt_lancamento, record.dt_vencimento, record.dt_pagamento,
          record.confirmado, record.status, record.raw_data, record.synced_at
        ]);

        if (result.rows[0]?.is_insert) {
          inserted++;
        } else {
          updated++;
        }
      } catch (error) {
        // Ignora erros de FK (estabelecimento pode não existir)
        if (!error.message.includes('violates foreign key')) {
          logger.debug(`Erro ao inserir conta ${record.cod_conta}:`, error.message);
        }
      }
    }

    return { inserted, updated };
  }

  async upsertVendas(records) {
    if (!records || records.length === 0) return { inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      try {
        const result = await db.query(`
          INSERT INTO vendas (cod_venda, cod_estab, cod_cliente, valor_venda, valor_desconto, valor_liquido, data_venda, cod_profissional, nome_profissional, status, confirmado, raw_data, synced_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (cod_venda, cod_estab)
          DO UPDATE SET
            valor_venda = EXCLUDED.valor_venda,
            valor_liquido = EXCLUDED.valor_liquido,
            data_venda = EXCLUDED.data_venda,
            confirmado = EXCLUDED.confirmado,
            raw_data = EXCLUDED.raw_data,
            synced_at = EXCLUDED.synced_at
          RETURNING (xmax = 0) AS is_insert
        `, [
          record.cod_venda, record.cod_estab, record.cod_cliente,
          record.valor_venda, record.valor_desconto, record.valor_liquido,
          record.data_venda, record.cod_profissional, record.nome_profissional,
          record.status, record.confirmado, record.raw_data, record.synced_at
        ]);

        if (result.rows[0]?.is_insert) {
          inserted++;
        } else {
          updated++;
        }
      } catch (error) {
        if (!error.message.includes('violates foreign key')) {
          logger.debug(`Erro ao inserir venda ${record.cod_venda}:`, error.message);
        }
      }
    }

    return { inserted, updated };
  }

  extractPhones(lead) {
    const phones = [];
    if (lead.PHONE) {
      if (Array.isArray(lead.PHONE)) {
        lead.PHONE.forEach(p => {
          const value = p.VALUE || p;
          if (value) phones.push(normalizePhone(value));
        });
      } else {
        phones.push(normalizePhone(lead.PHONE));
      }
    }
    return phones.filter(p => p.length >= 8);
  }

  extractEmails(lead) {
    const emails = [];
    if (lead.EMAIL) {
      if (Array.isArray(lead.EMAIL)) {
        lead.EMAIL.forEach(e => {
          const value = e.VALUE || e;
          if (value) emails.push(normalizeEmail(value));
        });
      } else {
        emails.push(normalizeEmail(lead.EMAIL));
      }
    }
    return emails.filter(e => e.includes('@'));
  }

  extractCustomFields(obj) {
    const custom = {};
    Object.keys(obj).forEach(key => {
      if (key.startsWith('UF_')) {
        custom[key] = obj[key];
      }
    });
    return custom;
  }

  extractNormalizedPhones(phonesJson) {
    try {
      const phones = typeof phonesJson === 'string' ? JSON.parse(phonesJson) : phonesJson;
      return Array.isArray(phones) ? phones : [];
    } catch {
      return [];
    }
  }

  extractNormalizedEmails(emailsJson) {
    try {
      const emails = typeof emailsJson === 'string' ? JSON.parse(emailsJson) : emailsJson;
      return Array.isArray(emails) ? emails : [];
    } catch {
      return [];
    }
  }

  parseBelleDate(dateStr) {
    if (!dateStr) return null;
    // Formato Belle: dd/mm/yyyy ou yyyy-mm-dd
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  }

  deduplicateByKeys(records, keys) {
    const seen = new Set();
    return records.filter(record => {
      const key = keys.map(k => record[k]).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ==================== STATUS ====================

  async getSyncStatus() {
    const result = await db.query(`
      SELECT
        ss.entity_type,
        ss.last_sync_at,
        ss.last_sync_status,
        ss.next_sync_at,
        ss.sync_interval_minutes,
        ss.is_enabled,
        sl.duration_ms as last_duration_ms,
        sl.records_fetched as last_records_fetched,
        sl.records_inserted as last_records_inserted,
        sl.records_updated as last_records_updated
      FROM sync_status ss
      LEFT JOIN sync_logs sl ON ss.last_sync_log_id = sl.id
      ORDER BY ss.entity_type
    `);

    return {
      isRunning: this.isRunning,
      intervalMinutes: config.sync.intervalMinutes,
      entities: result.rows,
    };
  }
}

export const syncService = new SyncService();
export default syncService;
