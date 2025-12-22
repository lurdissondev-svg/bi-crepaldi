import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import db from '../database/index.js';
import config from '../config/index.js';
import logger, { startTimer, logDataInconsistency } from '../utils/logger.js';
import bitrix24Service from './bitrix24.service.js';
import belleService from './belle.service.js';
import customerAnalyticsService from './customer-analytics.service.js';
import customerEnrichmentService from './customer-enrichment.service.js';
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
    this.inactivePatientsIntervalId = null; // Timer separado para pacientes inativos (15 min)
    this.customerEnrichmentIntervalId = null; // Timer separado para enriquecimento (30 min)
    this.syncQueue = [];
    this.lastSyncAt = null;
    this.nextSyncAt = null;
    this.lastSyncStatus = null;
  }

  /**
   * Retorna informações sobre o status da sincronização
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncAt: this.lastSyncAt,
      nextSyncAt: this.nextSyncAt,
      lastSyncStatus: this.lastSyncStatus,
      intervalMinutes: config.sync.intervalMinutes,
    };
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
    const inactivePatientsIntervalMs = 15 * 60 * 1000; // 15 minutos
    const customerEnrichmentIntervalMs = 30 * 60 * 1000; // 30 minutos

    logger.info(`Iniciando sync job a cada ${config.sync.intervalMinutes} minutos`);
    logger.info(`Iniciando sync de pacientes inativos a cada 15 minutos`);
    logger.info(`Iniciando enriquecimento de clientes a cada 30 minutos`);

    // Executa imediatamente na primeira vez
    this.runFullSync();

    // Executa sync de pacientes inativos após 30 segundos (para não sobrecarregar no início)
    setTimeout(() => {
      this.syncInactivePatients().catch(err =>
        logger.error('[InactivePatients] Erro no sync inicial:', err.message)
      );
    }, 30000);

    // Executa enriquecimento de clientes após 60 segundos
    setTimeout(() => {
      this.runCustomerEnrichment().catch(err =>
        logger.error('[Enrichment] Erro no enriquecimento inicial:', err.message)
      );
    }, 60000);

    // Configura o intervalo principal (5 min)
    this.intervalId = setInterval(() => {
      this.runFullSync();
    }, intervalMs);

    // Configura o intervalo de pacientes inativos (15 min)
    this.inactivePatientsIntervalId = setInterval(() => {
      this.syncInactivePatients().catch(err =>
        logger.error('[InactivePatients] Erro no sync agendado:', err.message)
      );
    }, inactivePatientsIntervalMs);

    // Configura o intervalo de enriquecimento de clientes (30 min)
    this.customerEnrichmentIntervalId = setInterval(() => {
      this.runCustomerEnrichment().catch(err =>
        logger.error('[Enrichment] Erro no enriquecimento agendado:', err.message)
      );
    }, customerEnrichmentIntervalMs);
  }

  /**
   * Calcula o próximo horário de sync
   */
  calculateNextSyncAt() {
    const intervalMs = config.sync.intervalMinutes * 60 * 1000;
    return new Date(Date.now() + intervalMs);
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
    if (this.inactivePatientsIntervalId) {
      clearInterval(this.inactivePatientsIntervalId);
      this.inactivePatientsIntervalId = null;
      logger.info('Sync de pacientes inativos parado');
    }
    if (this.customerEnrichmentIntervalId) {
      clearInterval(this.customerEnrichmentIntervalId);
      this.customerEnrichmentIntervalId = null;
      logger.info('Enriquecimento de clientes parado');
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
    const syncStartTime = new Date();

    try {
      logger.info('=== Iniciando sincronização completa ===');

      // Sync Bitrix24 e Belle em paralelo para não bloquear um ao outro
      const results = await Promise.allSettled([
        this.syncBitrixData(),
        this.syncBelleData(),
      ]);

      // Log resultados
      let hasErrors = false;
      if (results[0].status === 'rejected') {
        logger.error('Erro no sync Bitrix24:', results[0].reason?.message);
        hasErrors = true;
      }
      if (results[1].status === 'rejected') {
        logger.error('Erro no sync Belle:', results[1].reason?.message);
        hasErrors = true;
      }

      // Correlação Lead -> Venda (só se ambos terminaram)
      try {
        await this.runCorrelation();
      } catch (error) {
        logger.error('Erro na correlação:', error.message);
      }

      // Customer Analytics (Phase 2)
      try {
        await this.runCustomerAnalytics();
      } catch (error) {
        logger.error('Erro no customer analytics:', error.message);
      }

      // Agregações
      try {
        await this.updateAggregations();
      } catch (error) {
        logger.error('Erro nas agregações:', error.message);
      }

      timer({ status: 'success' });
      logger.info('=== Sincronização completa finalizada ===');

      // Atualiza status do sync (usa o momento atual como lastSyncAt, não o início)
      this.lastSyncAt = new Date();
      this.nextSyncAt = this.calculateNextSyncAt();
      this.lastSyncStatus = hasErrors ? 'partial' : 'success';

    } catch (error) {
      logger.error('Erro na sincronização completa:', error);
      timer({ status: 'error', error: error.message });

      // Atualiza status mesmo em caso de erro (usa o momento atual)
      this.lastSyncAt = new Date();
      this.nextSyncAt = this.calculateNextSyncAt();
      this.lastSyncStatus = 'error';
    } finally {
      this.isRunning = false;
      logger.info(`Próximo sync agendado para: ${this.nextSyncAt?.toLocaleString('pt-BR')}`);
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

      // Sync stage history (para métricas de conversão) - não bloqueia se falhar
      this.syncLeadStageHistory().catch(err =>
        logger.warn('[StageHistory] Erro no sync (não bloqueante):', err.message)
      );

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

  // ==================== SYNC LEAD STAGE HISTORY ====================

  /**
   * Sincroniza histórico de mudanças de estágio dos leads
   * Usa o endpoint crm.stagehistory.list do Bitrix24
   * Calcula métricas de tempo de conversão por estágio
   */
  async syncLeadStageHistory() {
    const logId = await this.startSyncLog('lead_status_history', 'full_sync');
    const timer = startTimer('Lead Stage History Sync');

    try {
      // Busca histórico dos últimos 90 dias
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');

      logger.info(`[StageHistory] Buscando histórico de ${startDate} a ${endDate}...`);

      const stageHistory = await bitrix24Service.getStageHistory(1, startDate, endDate);

      if (stageHistory.length === 0) {
        logger.info('[StageHistory] Nenhum histórico encontrado');
        await this.finishSyncLog(logId, 'success', { records_fetched: 0 });
        timer({ status: 'success', count: 0 });
        return;
      }

      // Busca nomes dos status para enriquecer os dados
      const statuses = await bitrix24Service.getLeadStatuses();
      const statusMap = {};
      statuses.forEach(s => { statusMap[s.STATUS_ID] = s.NAME; });

      // Agrupa transições por lead para calcular tempo em cada estágio
      const transitionsByLead = {};
      stageHistory.forEach(item => {
        const leadId = String(item.OWNER_ID);
        if (!transitionsByLead[leadId]) {
          transitionsByLead[leadId] = [];
        }
        transitionsByLead[leadId].push(item);
      });

      let inserted = 0;
      let updated = 0;

      // Processa cada lead e suas transições
      for (const [leadId, transitions] of Object.entries(transitionsByLead)) {
        // Ordena por tempo
        transitions.sort((a, b) => new Date(a.CREATED_TIME) - new Date(b.CREATED_TIME));

        // Busca o ID interno do lead no nosso banco
        const leadResult = await db.query(
          'SELECT id FROM leads WHERE bitrix_id = $1',
          [parseInt(leadId)]
        );
        const internalLeadId = leadResult.rows[0]?.id;

        // Insere cada transição
        for (let i = 0; i < transitions.length; i++) {
          const current = transitions[i];
          const previous = i > 0 ? transitions[i - 1] : null;

          // Calcula dias no estágio anterior
          let daysInPreviousStatus = 0;
          if (previous) {
            const prevTime = new Date(previous.CREATED_TIME);
            const currTime = new Date(current.CREATED_TIME);
            daysInPreviousStatus = Math.floor((currTime - prevTime) / (1000 * 60 * 60 * 24));
          }

          try {
            const result = await db.query(`
              INSERT INTO lead_status_history (
                lead_id, bitrix_lead_id,
                from_status_id, to_status_id,
                from_status_name, to_status_name,
                changed_at, days_in_previous_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT DO NOTHING
              RETURNING id
            `, [
              internalLeadId,
              parseInt(leadId),
              previous?.STAGE_ID || null,
              current.STAGE_ID,
              previous ? (statusMap[previous.STAGE_ID] || previous.STAGE_ID) : null,
              statusMap[current.STAGE_ID] || current.STAGE_ID,
              current.CREATED_TIME,
              daysInPreviousStatus,
            ]);

            if (result.rowCount > 0) {
              inserted++;
            }
          } catch (err) {
            // Ignora erros de duplicatas
            if (!err.message.includes('duplicate')) {
              logger.debug(`[StageHistory] Erro ao inserir transição: ${err.message}`);
            }
          }
        }
      }

      // Atualiza campo conversion_days nos leads que foram convertidos
      await this.updateLeadConversionDays();

      await this.finishSyncLog(logId, 'success', {
        records_fetched: stageHistory.length,
        records_inserted: inserted,
        date_from: startDate,
        date_to: endDate,
      });

      timer({ status: 'success', count: inserted });
      logger.info(`[StageHistory] ${inserted} transições sincronizadas de ${Object.keys(transitionsByLead).length} leads`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      timer({ status: 'error' });
      throw error;
    }
  }

  /**
   * Atualiza o campo conversion_days nos leads baseado no histórico de status
   */
  async updateLeadConversionDays() {
    try {
      // Calcula dias de conversão para leads convertidos (status semântico = S)
      await db.query(`
        UPDATE leads l
        SET conversion_days = COALESCE(
          (
            SELECT MAX(lsh.days_in_previous_status)
            FROM lead_status_history lsh
            WHERE lsh.bitrix_lead_id = l.bitrix_id
              AND lsh.to_status_id IN (
                SELECT bitrix_status_id FROM lead_statuses WHERE semantica = 'S'
              )
          ),
          CASE
            WHEN l.bitrix_closed_at IS NOT NULL AND l.bitrix_created_at IS NOT NULL
            THEN EXTRACT(DAY FROM l.bitrix_closed_at - l.bitrix_created_at)::INTEGER
            ELSE NULL
          END
        )
        WHERE l.status_id IN (
          SELECT bitrix_status_id FROM lead_statuses WHERE semantica = 'S'
        )
          AND l.conversion_days IS NULL
      `);

      logger.debug('[StageHistory] Dias de conversão atualizados nos leads');
    } catch (error) {
      logger.warn('[StageHistory] Erro ao atualizar conversion_days:', error.message);
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

      // Sync clientes (para enriquecimento de dados)
      await this.syncClientes();

      // Sync procedimentos e profissionais para o cache mensal (carregamento rápido)
      await this.syncProcedimentosProfissionaisCache();

      // Sync procedimentos diários para filtros de período curto (hoje, ontem, última semana)
      await this.syncProcedimentosDiarios();

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

      // Busca por estabelecimento para ter o codestab em cada registro
      const resultados = await belleService.getContasReceberTodosEstabelecimentos(
        inicioMesAnterior, fimMesAtual, 'lancamento'
      );

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      for (const resultado of resultados) {
        const dados = resultado.data || [];
        totalFetched += dados.length;

        if (!Array.isArray(dados) || dados.length === 0) continue;

        const records = dados.map(conta => ({
          cod_conta: parseInt(conta.cod_movimento) || 0, // API retorna cod_movimento
          cod_estab: resultado.codestab, // Usa o codestab do resultado
          cod_cliente: parseInt(conta.cod_cliente) || null,
          cod_venda: parseInt(conta.id_venda_relacionada) || null, // API retorna id_venda_relacionada
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

        // Agrupa por cod_conta + cod_estab para evitar duplicatas
        const uniqueRecords = this.deduplicateByKeys(records, ['cod_conta', 'cod_estab']);

        // Insere em batches de 500
        for (let i = 0; i < uniqueRecords.length; i += 500) {
          const batch = uniqueRecords.slice(i, i + 500);
          const result = await this.upsertContasReceber(batch);
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

      logger.info(`Contas a receber sincronizadas: ${totalFetched} (${inserted} novos, ${updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  async syncVendas() {
    const logId = await this.startSyncLog('vendas', 'full_sync');

    try {
      const hoje = new Date();
      // Período menor para vendas (últimos 14 dias) - API de vendas é mais lenta
      const inicioSync = format(subDays(hoje, 14), 'yyyy-MM-dd');
      const fimMesAtual = format(hoje, 'yyyy-MM-dd');

      const resultados = await belleService.getVendasTodosEstabelecimentos(inicioSync, fimMesAtual);

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      for (const resultado of resultados) {
        const vendas = resultado.data || [];
        totalFetched += vendas.length;

        const records = vendas.map(venda => ({
          cod_venda: parseInt(venda.id_venda) || 0, // API retorna id_venda
          cod_estab: resultado.codestab,
          cod_cliente: parseInt(venda.cod_cliente) || null,
          valor_venda: parseFloat(venda.valor_venda) || 0,
          valor_desconto: parseFloat(venda.valor_desconto) || 0,
          valor_liquido: parseFloat(venda.valor_liquido) || parseFloat(venda.valor_venda) || 0, // Usa valor_venda se valor_liquido não existir
          data_venda: venda.data_venda || null,
          cod_profissional: parseInt(venda.cod_profissional) || null,
          nome_profissional: venda.nome_profissional || null,
          status: venda.itens_venda?.[0]?.status || null, // Status vem dos itens
          confirmado: 'S', // Se veio na API, considera confirmado
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
        date_from: inicioSync,
        date_to: fimMesAtual,
      });

      logger.info(`Vendas sincronizadas: ${totalFetched} (${inserted} novos, ${updated} atualizados)`);
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  // ==================== SYNC CLIENTES ====================

  /**
   * Sincroniza clientes da Belle API para a tabela local
   * Necessário para o enriquecimento de dados de contato
   * OTIMIZADO: Processa página por página para não sobrecarregar memória
   */
  async syncClientes() {
    const logId = await this.startSyncLog('clientes', 'full_sync');
    const timer = startTimer('Clientes Sync');

    try {
      // Busca estabelecimentos ativos
      const estabsResult = await db.query(`
        SELECT cod_estab, nome FROM estabelecimentos WHERE ativo = true
      `);

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      for (const estab of estabsResult.rows) {
        try {
          let pagina = 0;
          let hasMore = true;
          let estabFetched = 0;

          // Processa página por página em vez de carregar tudo na memória
          while (hasMore) {
            const clientes = await belleService.getClientes(estab.cod_estab, pagina);

            if (!clientes || clientes.length === 0) {
              hasMore = false;
              if (pagina === 0) {
                logger.debug(`[Clientes] Nenhum cliente para estab ${estab.cod_estab}`);
              }
              continue;
            }

            // Processa batch de clientes desta página
            const batchResult = await this.processClientesBatch(clientes, estab.cod_estab);
            inserted += batchResult.inserted;
            updated += batchResult.updated;
            totalFetched += clientes.length;
            estabFetched += clientes.length;

            // Se retornou menos de 100, é a última página
            if (clientes.length < 100) {
              hasMore = false;
            } else {
              pagina++;
            }

            // Log a cada 500 clientes para acompanhar progresso
            if (estabFetched % 500 === 0) {
              logger.debug(`[Clientes] Estab ${estab.cod_estab}: ${estabFetched} clientes processados...`);
            }
          }

          if (estabFetched > 0) {
            logger.info(`[Clientes] Estab ${estab.cod_estab} (${estab.nome}): ${estabFetched} clientes`);
          }
        } catch (error) {
          logger.warn(`[Clientes] Erro estab ${estab.cod_estab}: ${error.message}`);
        }
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: totalFetched,
        records_inserted: inserted,
        records_updated: updated,
      });

      timer({ status: 'success', fetched: totalFetched, inserted, updated });
      logger.info(`[Clientes] Sincronizados: ${totalFetched} (${inserted} novos, ${updated} atualizados)`);

      return { fetched: totalFetched, inserted, updated };
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      timer({ status: 'error' });
      logger.error('[Clientes] Erro no sync:', error.message);
    }
  }

  /**
   * Processa um batch de clientes usando INSERT em lote para melhor performance
   */
  async processClientesBatch(clientes, codEstab) {
    let inserted = 0;
    let updated = 0;

    // Prepara valores para insert em lote
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const cliente of clientes) {
      const codCliente = parseInt(cliente.codigo) || parseInt(cliente.cod_cliente) || parseInt(cliente.id);
      if (!codCliente || isNaN(codCliente)) continue;

      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, NOW())`);

      // Trata datas inválidas (0000-00-00)
      const dtNasc = cliente.dtNascimento || cliente.data_nascimento;
      const dtCad = cliente.dtCadastro || cliente.data_cadastro;
      const validDtNasc = dtNasc && !dtNasc.startsWith('0000') ? dtNasc : null;
      const validDtCad = dtCad && !dtCad.startsWith('0000') ? dtCad : null;

      params.push(
        codCliente,
        codEstab,
        cliente.nome || cliente.razao_social || `Cliente ${codCliente}`,
        cliente.telefone || cliente.fone || null,
        cliente.celular || cliente.fone_celular || null,
        cliente.email || null,
        cliente.cpf || cliente.cnpj_cpf || null,
        validDtNasc,
        cliente.sexo ? cliente.sexo.charAt(0).toUpperCase() : null,
        cliente.endereco || null,
        cliente.cidade || null,
        cliente.UF || cliente.uf || cliente.estado || null,
        cliente.cep || null,
        validDtCad,
        cliente.ativo !== 'N' && cliente.ativo !== false
      );

      paramIndex += 15;
    }

    if (values.length === 0) return { inserted: 0, updated: 0 };

    try {
      const result = await db.query(`
        INSERT INTO clientes (
          cod_cliente, cod_estab, nome, telefone, celular, email,
          cpf, data_nascimento, sexo, endereco, cidade, uf, cep,
          data_cadastro, ativo, synced_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (cod_cliente, cod_estab)
        DO UPDATE SET
          nome = COALESCE(EXCLUDED.nome, clientes.nome),
          telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), clientes.telefone),
          celular = COALESCE(NULLIF(EXCLUDED.celular, ''), clientes.celular),
          email = COALESCE(NULLIF(EXCLUDED.email, ''), clientes.email),
          cpf = COALESCE(EXCLUDED.cpf, clientes.cpf),
          data_nascimento = COALESCE(EXCLUDED.data_nascimento, clientes.data_nascimento),
          sexo = COALESCE(EXCLUDED.sexo, clientes.sexo),
          endereco = COALESCE(EXCLUDED.endereco, clientes.endereco),
          cidade = COALESCE(EXCLUDED.cidade, clientes.cidade),
          uf = COALESCE(EXCLUDED.uf, clientes.uf),
          cep = COALESCE(EXCLUDED.cep, clientes.cep),
          ativo = EXCLUDED.ativo,
          synced_at = NOW(),
          updated_at = NOW()
      `, params);

      // Estima inserted vs updated (PostgreSQL não retorna isso facilmente em bulk)
      updated = result.rowCount;
    } catch (error) {
      logger.debug(`[Clientes] Erro no batch insert: ${error.message}`);
      // Fallback: processa um por um se o batch falhar
      for (const cliente of clientes) {
        try {
          const codCliente = parseInt(cliente.codigo) || parseInt(cliente.cod_cliente) || parseInt(cliente.id);
          if (!codCliente || isNaN(codCliente)) continue;

          // Trata datas inválidas
          const dtNasc = cliente.dtNascimento || cliente.data_nascimento;
          const dtCad = cliente.dtCadastro || cliente.data_cadastro;
          const validDtNasc = dtNasc && !dtNasc.startsWith('0000') ? dtNasc : null;
          const validDtCad = dtCad && !dtCad.startsWith('0000') ? dtCad : null;

          const result = await db.query(`
            INSERT INTO clientes (cod_cliente, cod_estab, nome, telefone, celular, email, cpf, data_nascimento, sexo, endereco, cidade, uf, cep, data_cadastro, ativo, synced_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (cod_cliente, cod_estab) DO UPDATE SET
              nome = COALESCE(EXCLUDED.nome, clientes.nome),
              telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), clientes.telefone),
              celular = COALESCE(NULLIF(EXCLUDED.celular, ''), clientes.celular),
              synced_at = NOW(), updated_at = NOW()
            RETURNING (xmax = 0) AS is_insert
          `, [
            codCliente, codEstab,
            cliente.nome || `Cliente ${codCliente}`,
            cliente.telefone || null,
            cliente.celular || null,
            cliente.email || null,
            cliente.cpf || null,
            validDtNasc,
            cliente.sexo ? cliente.sexo.charAt(0).toUpperCase() : null,
            cliente.endereco || null,
            cliente.cidade || null,
            cliente.UF || cliente.uf || null,
            cliente.cep || null,
            validDtCad,
            cliente.ativo !== 'N' && cliente.ativo !== false
          ]);

          if (result.rows[0]?.is_insert) inserted++;
          else if (result.rowCount > 0) updated++;
        } catch (err) {
          // Ignora erros individuais
        }
      }
    }

    return { inserted, updated };
  }

  // ==================== SYNC PROCEDIMENTOS E PROFISSIONAIS CACHE ====================

  /**
   * Sincroniza procedimentos e profissionais da Belle API para o cache local
   * Usa os endpoints movimentacao_detalhado e venda_planos
   * Dados são agregados mensalmente para consulta rápida
   */
  async syncProcedimentosProfissionaisCache() {
    const timer = startTimer('Procedimentos/Profissionais Cache Sync');

    try {
      // Sincroniza o mês atual e o mês anterior
      const hoje = new Date();
      const mesesParaSync = [
        format(hoje, 'yyyy-MM'),
        format(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), 'yyyy-MM'),
      ];

      for (const anoMes of mesesParaSync) {
        const [ano, mes] = anoMes.split('-').map(Number);
        const dataInicio = format(new Date(ano, mes - 1, 1), 'yyyy-MM-dd');
        const dataFim = format(new Date(ano, mes, 0), 'yyyy-MM-dd');

        logger.info(`[Cache] Sincronizando procedimentos e profissionais de ${anoMes}...`);

        // Busca procedimentos POR ESTABELECIMENTO e profissionais da Belle API
        const [procedimentosPorEstab, profissionais] = await Promise.all([
          belleService.getProcedimentosByEstabelecimento(dataInicio, dataFim, 100).catch(err => {
            logger.warn(`[Cache] Erro ao buscar procedimentos por estabelecimento: ${err.message}`);
            return [];
          }),
          belleService.getProfissionaisFromAPIs(dataInicio, dataFim, 50).catch(err => {
            logger.warn(`[Cache] Erro ao buscar profissionais: ${err.message}`);
            return [];
          }),
        ]);

        // Salva procedimentos no cache (agora por estabelecimento)
        if (procedimentosPorEstab.length > 0) {
          await this.upsertProcedimentosCache(anoMes, procedimentosPorEstab);
          logger.debug(`[Cache] ${procedimentosPorEstab.length} procedimentos por estabelecimento salvos para ${anoMes}`);
        }

        // Salva profissionais no cache
        if (profissionais.length > 0) {
          await this.upsertProfissionaisCache(anoMes, profissionais);
          logger.debug(`[Cache] ${profissionais.length} profissionais salvos para ${anoMes}`);
        }
      }

      // Atualiza status do cache
      await db.query(`
        UPDATE cache_sync_status
        SET last_sync_at = NOW(), last_sync_status = 'success', updated_at = NOW()
        WHERE cache_type IN ('procedimentos', 'profissionais')
      `);

      timer({ status: 'success' });
      logger.info('[Cache] Sync de procedimentos e profissionais concluído');
    } catch (error) {
      logger.error('[Cache] Erro no sync de procedimentos/profissionais:', error.message);

      // Atualiza status de erro
      await db.query(`
        UPDATE cache_sync_status
        SET last_sync_at = NOW(), last_sync_status = 'error', error_message = $1, updated_at = NOW()
        WHERE cache_type IN ('procedimentos', 'profissionais')
      `, [error.message]).catch(() => {});

      timer({ status: 'error' });
      // Não lança erro para não interromper o sync principal
    }
  }

  /**
   * Upsert de procedimentos no cache (por estabelecimento)
   * Procedimentos agora incluem cod_estab e nome_estab
   */
  async upsertProcedimentosCache(anoMes, procedimentos) {
    for (const proc of procedimentos) {
      try {
        await db.query(`
          INSERT INTO procedimentos_cache (ano_mes, nome, quantidade, valor, cod_estab, nome_estab, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (ano_mes, nome, cod_estab)
          DO UPDATE SET
            quantidade = EXCLUDED.quantidade,
            valor = EXCLUDED.valor,
            nome_estab = EXCLUDED.nome_estab,
            updated_at = NOW()
        `, [anoMes, proc.nome, proc.quantidade || 0, proc.valor || 0, proc.cod_estab || null, proc.nome_estab || null]);
      } catch (error) {
        logger.debug(`[Cache] Erro ao inserir procedimento ${proc.nome} (estab ${proc.cod_estab}): ${error.message}`);
      }
    }
  }

  /**
   * Upsert de profissionais no cache
   * Nota: profissionais são agregados de todos os estabelecimentos, então usamos (ano_mes, nome)
   */
  async upsertProfissionaisCache(anoMes, profissionais) {
    for (const prof of profissionais) {
      try {
        await db.query(`
          INSERT INTO profissionais_cache (ano_mes, nome, vendas, valor, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (ano_mes, nome)
          DO UPDATE SET
            vendas = EXCLUDED.vendas,
            valor = EXCLUDED.valor,
            updated_at = NOW()
        `, [anoMes, prof.nome, prof.vendas || 0, prof.valor || 0]);
      } catch (error) {
        logger.debug(`[Cache] Erro ao inserir profissional ${prof.nome}: ${error.message}`);
      }
    }
  }

  /**
   * Sincroniza procedimentos diários para filtros de período curto
   * Busca dados dos últimos 14 dias e armazena por data específica
   * Extrai serviços individuais dos planos (não apenas "Plano Personalizado")
   */
  async syncProcedimentosDiarios() {
    const timer = startTimer('Procedimentos Diarios Sync');

    try {
      // Período: últimos 14 dias para garantir dados recentes
      const hoje = new Date();
      const dataInicio = format(subDays(hoje, 14), 'yyyy-MM-dd');
      const dataFim = format(hoje, 'yyyy-MM-dd');

      logger.info(`[Diarios] Sincronizando procedimentos de ${dataInicio} a ${dataFim}...`);

      // Busca procedimentos com datas da Belle API
      const procedimentos = await belleService.getProcedimentosDiariosPorEstab(dataInicio, dataFim)
        .catch(err => {
          logger.warn(`[Diarios] Erro ao buscar procedimentos diarios: ${err.message}`);
          return [];
        });

      if (procedimentos.length === 0) {
        logger.info('[Diarios] Nenhum procedimento diario encontrado');
        timer({ status: 'success', count: 0 });
        return;
      }

      // Limpa dados antigos do período para evitar duplicatas
      await db.query(`
        DELETE FROM procedimentos_diarios
        WHERE data_ref >= $1 AND data_ref <= $2
      `, [dataInicio, dataFim]).catch(err => {
        logger.warn(`[Diarios] Erro ao limpar dados antigos: ${err.message}`);
      });

      // Insere novos dados
      let inserted = 0;
      for (const proc of procedimentos) {
        try {
          await db.query(`
            INSERT INTO procedimentos_diarios (data_ref, cod_estab, nome_estab, nome_proc, quantidade, valor, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (data_ref, cod_estab, nome_proc)
            DO UPDATE SET
              quantidade = EXCLUDED.quantidade,
              valor = EXCLUDED.valor,
              nome_estab = EXCLUDED.nome_estab,
              updated_at = NOW()
          `, [proc.data_ref, proc.cod_estab, proc.nome_estab, proc.nome_proc, proc.quantidade || 0, proc.valor || 0]);
          inserted++;
        } catch (error) {
          logger.debug(`[Diarios] Erro ao inserir procedimento ${proc.nome_proc}: ${error.message}`);
        }
      }

      // Atualiza status do cache
      await db.query(`
        UPDATE cache_sync_status
        SET last_sync_at = NOW(), last_sync_status = 'success', records_synced = $1, updated_at = NOW()
        WHERE cache_type = 'procedimentos_diarios'
      `, [inserted]).catch(() => {});

      timer({ status: 'success', count: inserted });
      logger.info(`[Diarios] ${inserted} procedimentos diarios sincronizados`);
    } catch (error) {
      logger.error('[Diarios] Erro no sync de procedimentos diarios:', error.message);

      // Atualiza status de erro
      await db.query(`
        UPDATE cache_sync_status
        SET last_sync_at = NOW(), last_sync_status = 'error', error_message = $1, updated_at = NOW()
        WHERE cache_type = 'procedimentos_diarios'
      `, [error.message]).catch(() => {});

      timer({ status: 'error' });
      // Não lança erro para não interromper o sync principal
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

  // ==================== CUSTOMER ANALYTICS ====================

  async runCustomerAnalytics() {
    const timer = startTimer('Customer Analytics');

    try {
      // Atualiza métricas de todos os clientes (LTV, RFM)
      const analyticsResult = await customerAnalyticsService.updateCustomerAnalytics();
      logger.info(`[CustomerAnalytics] ${analyticsResult.updatedCount} clientes atualizados`);

      // Mapeia leads para clientes existentes
      const mappingResult = await customerAnalyticsService.mapLeadsToCustomers();
      logger.info(`[CustomerAnalytics] ${mappingResult.matchedCount} leads mapeados`);

      timer({ status: 'success', analytics: analyticsResult.updatedCount, mappings: mappingResult.matchedCount });
    } catch (error) {
      logger.error('Erro no customer analytics:', error.message);
      timer({ status: 'error' });
      throw error;
    }
  }

  // ==================== CUSTOMER ENRICHMENT ====================

  /**
   * Executa o enriquecimento de dados de contato de clientes
   * Preenche telefone, celular e email faltantes a partir de:
   * 1. Leads Bitrix24 correlacionados
   * 2. Raw data de contas_receber e vendas
   * 3. Mesmo cliente em outros estabelecimentos
   */
  async runCustomerEnrichment() {
    const logId = await this.startSyncLog('customer_enrichment', 'full_sync');
    const timer = startTimer('Customer Enrichment');

    try {
      logger.info('[Enrichment] Iniciando enriquecimento de clientes...');

      const result = await customerEnrichmentService.runEnrichment({
        limit: 100, // Processa 100 clientes por execução
        dryRun: false,
      });

      await this.finishSyncLog(logId, 'success', {
        records_fetched: result.processed,
        records_inserted: result.enriched,
        records_updated: 0,
      });

      timer({ status: 'success', enriched: result.enriched });
      logger.info(`[Enrichment] ${result.enriched} clientes enriquecidos de ${result.processed} processados`);

      return result;
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      timer({ status: 'error' });
      logger.error('[Enrichment] Erro no enriquecimento:', error.message);
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

  // ==================== SYNC PACIENTES INATIVOS ====================

  /**
   * Sincroniza tabela de pacientes inativos
   * Executa a cada 15 minutos (separado do sync principal de 5 min)
   * IMPORTANTE: Usa dados do banco (contas_receber) para garantir consistência
   * e considera a última visita em QUALQUER estabelecimento
   */
  async syncInactivePatients() {
    const logId = await this.startSyncLog('pacientes_inativos', 'full_sync');
    const timer = startTimer('Inactive Patients Sync');

    try {
      logger.info('[InactivePatients] Iniciando sync de pacientes inativos do banco de dados...');

      // Busca dados agregados de TODOS os estabelecimentos por cliente
      // A última visita é a mais recente em QUALQUER estabelecimento
      const clientesResult = await db.query(`
        SELECT
          cod_cliente,
          MAX(raw_data->>'nome_cliente') as cliente_nome,
          MAX(dt_lancamento) as ultima_visita,
          COUNT(*) as total_compras,
          SUM(COALESCE(valor_bruto, 0)) as total_investido,
          -- Pega o estabelecimento da última visita
          (SELECT cod_estab FROM contas_receber cr2
           WHERE cr2.cod_cliente = cr.cod_cliente
           ORDER BY dt_lancamento DESC LIMIT 1) as ultimo_estab
        FROM contas_receber cr
        WHERE cod_cliente IS NOT NULL
          AND valor_bruto > 0
          AND dt_lancamento >= '2024-01-01'
        GROUP BY cod_cliente
        HAVING MAX(dt_lancamento) < CURRENT_DATE - INTERVAL '60 days'
        ORDER BY MAX(dt_lancamento) DESC
      `);

      const clientes = clientesResult.rows;
      logger.info(`[InactivePatients] ${clientes.length} clientes inativos encontrados no banco`);

      // Calcula dias sem vir e define nível de risco
      const hoje = new Date();
      const pacientesInativos = [];

      for (const cliente of clientes) {
        if (!cliente.ultima_visita) continue;

        const ultimaVisita = new Date(cliente.ultima_visita);
        const diasSemVir = Math.floor((hoje - ultimaVisita) / (1000 * 60 * 60 * 24));

        // Define nível de risco
        let nivelRisco = 'baixo'; // 60-89 dias
        if (diasSemVir >= 180) nivelRisco = 'critico';
        else if (diasSemVir >= 120) nivelRisco = 'alto';
        else if (diasSemVir >= 90) nivelRisco = 'medio';

        const ticketMedio = cliente.total_compras > 0
          ? parseFloat(cliente.total_investido) / parseInt(cliente.total_compras)
          : 0;

        pacientesInativos.push({
          cliente_id: cliente.cod_cliente,
          cliente_nome: cliente.cliente_nome || `Cliente ${cliente.cod_cliente}`,
          cod_estab: cliente.ultimo_estab,
          ultima_visita: format(ultimaVisita, 'yyyy-MM-dd'),
          dias_sem_vir: diasSemVir,
          total_investido: parseFloat(cliente.total_investido) || 0,
          total_compras: parseInt(cliente.total_compras) || 0,
          ticket_medio: ticketMedio,
          nivel_risco: nivelRisco,
        });
      }

      logger.info(`[InactivePatients] ${pacientesInativos.length} pacientes inativos identificados (60+ dias)`);

      // Remove pacientes que voltaram (estão na tabela mas têm visita recente no banco)
      const reativadosResult = await db.query(`
        UPDATE pacientes_inativos pi
        SET reativado_em = NOW()
        WHERE reativado_em IS NULL
          AND EXISTS (
            SELECT 1 FROM contas_receber cr
            WHERE cr.cod_cliente = pi.cliente_id
              AND cr.dt_lancamento > pi.ultima_visita
              AND cr.dt_lancamento >= CURRENT_DATE - INTERVAL '60 days'
          )
        RETURNING cliente_id
      `);

      if (reativadosResult.rowCount > 0) {
        logger.info(`[InactivePatients] ${reativadosResult.rowCount} pacientes reativados (voltaram a comprar)`);
      }

      // Upsert dos pacientes inativos
      let inserted = 0;
      let updated = 0;

      for (const paciente of pacientesInativos) {
        try {
          const result = await db.query(`
            INSERT INTO pacientes_inativos
              (cliente_id, cliente_nome, cod_estab,
               ultima_visita, dias_sem_vir, total_investido, total_compras,
               ticket_medio, nivel_risco, data_atualizacao)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (cliente_id)
            DO UPDATE SET
              cliente_nome = EXCLUDED.cliente_nome,
              cod_estab = EXCLUDED.cod_estab,
              ultima_visita = EXCLUDED.ultima_visita,
              dias_sem_vir = EXCLUDED.dias_sem_vir,
              total_investido = EXCLUDED.total_investido,
              total_compras = EXCLUDED.total_compras,
              ticket_medio = EXCLUDED.ticket_medio,
              nivel_risco = EXCLUDED.nivel_risco,
              data_atualizacao = NOW()
            WHERE pacientes_inativos.reativado_em IS NULL
            RETURNING (xmax = 0) AS is_insert
          `, [
            paciente.cliente_id,
            paciente.cliente_nome,
            paciente.cod_estab,
            paciente.ultima_visita,
            paciente.dias_sem_vir,
            paciente.total_investido,
            paciente.total_compras,
            paciente.ticket_medio,
            paciente.nivel_risco,
          ]);

          if (result.rows[0]?.is_insert) {
            inserted++;
          } else if (result.rowCount > 0) {
            updated++;
          }
        } catch (error) {
          logger.debug(`[InactivePatients] Erro ao inserir paciente ${paciente.cliente_id}: ${error.message}`);
        }
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: clientes.length,
        records_inserted: inserted,
        records_updated: updated,
      });

      timer({ status: 'success', inactive: pacientesInativos.length, inserted, updated });
      logger.info(`[InactivePatients] Sync finalizado: ${inserted} novos, ${updated} atualizados`);

      return { inserted, updated, total: pacientesInativos.length };
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      timer({ status: 'error' });
      logger.error('[InactivePatients] Erro no sync:', error.message);
      throw error;
    }
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

  // ==================== BACKFILL HISTÓRICO ====================

  /**
   * Executa backfill de dados históricos de um período específico
   * Útil para importar dados que não foram sincronizados anteriormente
   * @param {string} dataInicio - Data de início (yyyy-MM-dd)
   * @param {string} dataFim - Data de fim (yyyy-MM-dd)
   * @param {string[]} entities - Entidades para sincronizar ['contas_receber', 'vendas']
   */
  async runBackfill(dataInicio, dataFim, entities = ['contas_receber', 'vendas']) {
    const timer = startTimer('Backfill Histórico');
    const results = {
      contas_receber: { fetched: 0, inserted: 0, updated: 0 },
      vendas: { fetched: 0, inserted: 0, updated: 0 },
      faturamento_diario: { updated: 0 },
    };

    logger.info(`[Backfill] Iniciando backfill de ${dataInicio} a ${dataFim}`);
    logger.info(`[Backfill] Entidades: ${entities.join(', ')}`);

    try {
      // Backfill de contas_receber
      if (entities.includes('contas_receber')) {
        const contasResult = await this.backfillContasReceber(dataInicio, dataFim);
        results.contas_receber = contasResult;
      }

      // Backfill de vendas
      if (entities.includes('vendas')) {
        const vendasResult = await this.backfillVendas(dataInicio, dataFim);
        results.vendas = vendasResult;
      }

      // Atualiza faturamento_diario com os novos dados
      await this.updateFaturamentoDiarioFromBackfill(dataInicio, dataFim);
      results.faturamento_diario.updated = 1;

      timer({ status: 'success' });
      logger.info(`[Backfill] Concluído com sucesso`, results);

      return {
        success: true,
        period: { from: dataInicio, to: dataFim },
        results,
      };
    } catch (error) {
      timer({ status: 'error' });
      logger.error(`[Backfill] Erro:`, error.message);
      throw error;
    }
  }

  /**
   * Backfill de contas_receber para um período específico
   */
  async backfillContasReceber(dataInicio, dataFim) {
    const logId = await this.startSyncLog('contas_receber', 'backfill');

    try {
      // Divide o período em chunks de 3 meses
      const chunks = belleService.dividePeriodoEmChunks(dataInicio, dataFim);

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      logger.info(`[Backfill] Contas a receber: ${chunks.length} chunks`);

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        logger.info(`[Backfill] Processando chunk ${chunkIdx + 1}/${chunks.length}: ${chunk.inicio} a ${chunk.fim}`);

        const resultados = await belleService.getContasReceberTodosEstabelecimentos(
          chunk.inicio, chunk.fim, 'lancamento'
        );

        for (const resultado of resultados) {
          const dados = resultado.data || [];
          totalFetched += dados.length;

          if (!Array.isArray(dados) || dados.length === 0) continue;

          const records = dados.map(conta => ({
            cod_conta: parseInt(conta.cod_movimento) || 0,
            cod_estab: resultado.codestab,
            cod_cliente: parseInt(conta.cod_cliente) || null,
            cod_venda: parseInt(conta.id_venda_relacionada) || null,
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

          const uniqueRecords = this.deduplicateByKeys(records, ['cod_conta', 'cod_estab']);

          for (let i = 0; i < uniqueRecords.length; i += 500) {
            const batch = uniqueRecords.slice(i, i + 500);
            const result = await this.upsertContasReceber(batch);
            inserted += result.inserted;
            updated += result.updated;
          }
        }

        logger.info(`[Backfill] Chunk ${chunkIdx + 1} concluído: ${totalFetched} registros até agora`);
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: totalFetched,
        records_inserted: inserted,
        records_updated: updated,
        date_from: dataInicio,
        date_to: dataFim,
      });

      logger.info(`[Backfill] Contas a receber: ${totalFetched} buscados, ${inserted} inseridos, ${updated} atualizados`);

      return { fetched: totalFetched, inserted, updated };
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  /**
   * Backfill de vendas para um período específico
   */
  async backfillVendas(dataInicio, dataFim) {
    const logId = await this.startSyncLog('vendas', 'backfill');

    try {
      const chunks = belleService.dividePeriodoEmChunks(dataInicio, dataFim);

      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      logger.info(`[Backfill] Vendas: ${chunks.length} chunks`);

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        logger.info(`[Backfill] Processando chunk ${chunkIdx + 1}/${chunks.length}: ${chunk.inicio} a ${chunk.fim}`);

        const resultados = await belleService.getVendasTodosEstabelecimentos(chunk.inicio, chunk.fim);

        for (const resultado of resultados) {
          const vendas = resultado.data || [];
          totalFetched += vendas.length;

          const records = vendas.map(venda => ({
            cod_venda: parseInt(venda.id_venda) || 0,
            cod_estab: resultado.codestab,
            cod_cliente: parseInt(venda.cod_cliente) || null,
            valor_venda: parseFloat(venda.valor_venda) || 0,
            valor_desconto: parseFloat(venda.valor_desconto) || 0,
            valor_liquido: parseFloat(venda.valor_liquido) || parseFloat(venda.valor_venda) || 0,
            data_venda: venda.data_venda || null,
            cod_profissional: parseInt(venda.cod_profissional) || null,
            nome_profissional: venda.nome_profissional || null,
            status: venda.itens_venda?.[0]?.status || null,
            confirmado: 'S',
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

        logger.info(`[Backfill] Chunk ${chunkIdx + 1} concluído: ${totalFetched} registros até agora`);
      }

      await this.finishSyncLog(logId, 'success', {
        records_fetched: totalFetched,
        records_inserted: inserted,
        records_updated: updated,
        date_from: dataInicio,
        date_to: dataFim,
      });

      logger.info(`[Backfill] Vendas: ${totalFetched} buscados, ${inserted} inseridos, ${updated} atualizados`);

      return { fetched: totalFetched, inserted, updated };
    } catch (error) {
      await this.finishSyncLog(logId, 'error', {}, error.message);
      throw error;
    }
  }

  /**
   * Atualiza faturamento_diario a partir dos dados do banco
   */
  async updateFaturamentoDiarioFromBackfill(dataInicio, dataFim) {
    logger.info(`[Backfill] Atualizando faturamento_diario de ${dataInicio} a ${dataFim}`);

    const query = `
      WITH dados_diarios AS (
        SELECT
          dt_lancamento::date as data_ref,
          cod_estab,
          SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) as valor_total,
          COUNT(CASE WHEN confirmado = 'S' THEN 1 END) as quantidade_movimentos,
          CASE
            WHEN COUNT(CASE WHEN confirmado = 'S' THEN 1 END) > 0
            THEN SUM(CASE WHEN confirmado = 'S' THEN valor_bruto ELSE 0 END) / COUNT(CASE WHEN confirmado = 'S' THEN 1 END)
            ELSE 0
          END as ticket_medio
        FROM contas_receber
        WHERE dt_lancamento >= $1 AND dt_lancamento <= $2
        GROUP BY dt_lancamento::date, cod_estab
      )
      INSERT INTO faturamento_diario (
        data_referencia, cod_estab, valor_total,
        quantidade_movimentos, ticket_medio, calculated_at
      )
      SELECT
        data_ref,
        cod_estab,
        valor_total,
        quantidade_movimentos,
        ticket_medio,
        NOW()
      FROM dados_diarios
      ON CONFLICT (data_referencia, cod_estab)
      DO UPDATE SET
        valor_total = EXCLUDED.valor_total,
        quantidade_movimentos = EXCLUDED.quantidade_movimentos,
        ticket_medio = EXCLUDED.ticket_medio,
        calculated_at = NOW()
    `;

    await db.query(query, [dataInicio, dataFim]);
    logger.info(`[Backfill] Faturamento diário atualizado`);
  }

  /**
   * Backfill rápido do ano atual (2025)
   */
  async backfillCurrentYear() {
    const anoAtual = new Date().getFullYear();
    const dataInicio = `${anoAtual}-01-01`;
    const dataFim = format(new Date(), 'yyyy-MM-dd');

    return this.runBackfill(dataInicio, dataFim);
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
