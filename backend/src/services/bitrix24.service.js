import axios from 'axios';
import NodeCache from 'node-cache';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Mapeamento do campo "Origem do lead" (UF_CRM_1692640693814)
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
};

class Bitrix24Service {
  constructor() {
    this.baseUrl = config.bitrix24.webhookUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.origemLeadMap = ORIGEM_LEAD_MAP;

    // Cache para chamadas de API - TTL de 3 minutos
    this.cache = new NodeCache({
      stdTTL: 180,
      checkperiod: 60,
      useClones: false
    });

    // Cache de chamadas em andamento para evitar duplicatas
    this.pendingRequests = new Map();
  }

  // Gera chave de cache
  getCacheKey(method, params = {}) {
    const sortedParams = Object.keys(params)
      .filter(k => k !== 'start') // Não incluir start na chave para paginação
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `bitrix:${method}:${sortedParams}`;
  }

  // Limpa cache
  clearCache() {
    this.cache.flushAll();
    logger.info('[Bitrix24 Service] Cache limpo');
  }

  // Método para obter o nome da origem do lead pelo ID
  getOrigemLeadName(origemId) {
    if (!origemId) return 'Não preenchido';
    return ORIGEM_LEAD_MAP[String(origemId)] || 'Não identificado';
  }

  async callMethod(method, params = {}) {
    try {
      const response = await this.client.post(method, params);
      return response.data;
    } catch (error) {
      logger.error(`Bitrix24 API Error [${method}]:`, error.message);
      throw error;
    }
  }

  async getAllPaginated(method, params = {}, maxItems = null) {
    const cacheKey = this.getCacheKey(method, { ...params, maxItems });

    // Verifica cache primeiro
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug(`[Bitrix Cache HIT] ${cacheKey}`);
      return cached;
    }

    // Verifica se há requisição em andamento
    if (this.pendingRequests.has(cacheKey)) {
      logger.debug(`[Bitrix Dedup] Aguardando requisição existente: ${cacheKey}`);
      return this.pendingRequests.get(cacheKey);
    }

    logger.debug(`[Bitrix Cache MISS] Buscando: ${cacheKey}`);

    const requestPromise = (async () => {
      const allItems = [];
      let start = 0;
      const batchSize = 50;

      while (true) {
        const response = await this.callMethod(method, { ...params, start });
        const items = response.result || [];
        allItems.push(...items);

        if (maxItems && allItems.length >= maxItems) {
          const result = allItems.slice(0, maxItems);
          this.cache.set(cacheKey, result);
          this.pendingRequests.delete(cacheKey);
          return result;
        }

        if (!response.next || items.length < batchSize) {
          break;
        }

        start = response.next;
        // Delay para evitar rate limiting (503)
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      this.cache.set(cacheKey, allItems);
      this.pendingRequests.delete(cacheKey);
      return allItems;
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  // ==================== LEADS ====================

  async getLeadFields() {
    return this.callMethod('crm.lead.fields');
  }

  async getLeads(filter = {}, select = ['*', 'UF_*']) {
    return this.getAllPaginated('crm.lead.list', {
      filter,
      select,
      order: { DATE_CREATE: 'DESC' },
    });
  }

  async getLeadsByDateRange(startDate, endDate, additionalFilter = {}) {
    const filter = {
      '>=DATE_CREATE': startDate,
      '<=DATE_CREATE': endDate,
      ...additionalFilter,
    };

    return this.getLeads(filter, [
      'ID', 'TITLE', 'NAME', 'LAST_NAME', 'STATUS_ID', 'SOURCE_ID', 'SOURCE_DESCRIPTION',
      'OPPORTUNITY', 'CURRENCY_ID', 'DATE_CREATE', 'DATE_MODIFY', 'DATE_CLOSED',
      'ASSIGNED_BY_ID', 'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_CONTENT', 'UTM_TERM',
      'PHONE', 'EMAIL', 'COMPANY_TITLE', 'UF_*'
    ]);
  }

  async getLeadStatuses() {
    const response = await this.callMethod('crm.status.list', {
      filter: { ENTITY_ID: 'STATUS' }
    });
    return response.result || [];
  }

  async getLeadSources() {
    const response = await this.callMethod('crm.status.list', {
      filter: { ENTITY_ID: 'SOURCE' }
    });
    return response.result || [];
  }

  // ==================== DEALS ====================

  async getDealFields() {
    return this.callMethod('crm.deal.fields');
  }

  async getDeals(filter = {}, select = ['*', 'UF_*']) {
    return this.getAllPaginated('crm.deal.list', {
      filter,
      select,
      order: { DATE_CREATE: 'DESC' },
    });
  }

  async getDealsByDateRange(startDate, endDate, additionalFilter = {}) {
    const filter = {
      '>=DATE_CREATE': startDate,
      '<=DATE_CREATE': endDate,
      ...additionalFilter,
    };

    return this.getDeals(filter, [
      'ID', 'TITLE', 'STAGE_ID', 'CATEGORY_ID', 'OPPORTUNITY', 'CURRENCY_ID',
      'DATE_CREATE', 'DATE_MODIFY', 'CLOSEDATE', 'ASSIGNED_BY_ID', 'CONTACT_ID',
      'COMPANY_ID', 'SOURCE_ID', 'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN',
      'UTM_CONTENT', 'UTM_TERM', 'UF_*'
    ]);
  }

  async getDealStages(categoryId = 0) {
    const entityId = categoryId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${categoryId}`;
    const response = await this.callMethod('crm.status.list', {
      filter: { ENTITY_ID: entityId }
    });
    return response.result || [];
  }

  async getDealCategories() {
    const response = await this.callMethod('crm.category.list', {
      entityTypeId: 2
    });
    return response.result?.categories || [];
  }

  // ==================== CONTACTS ====================

  async getContacts(filter = {}, select = ['*']) {
    return this.getAllPaginated('crm.contact.list', {
      filter,
      select,
      order: { DATE_CREATE: 'DESC' },
    });
  }

  // ==================== ANALYTICS ====================

  async getLeadsAnalytics(startDate, endDate) {
    const leads = await this.getLeadsByDateRange(startDate, endDate);
    const statuses = await this.getLeadStatuses();
    const sources = await this.getLeadSources();

    const statusMap = {};
    statuses.forEach(s => { statusMap[s.STATUS_ID] = s; });

    const sourceMap = {};
    sources.forEach(s => { sourceMap[s.STATUS_ID] = s; });

    // Categorizar leads por status semântico
    const categorized = {
      new: [], // Novos (em andamento)
      inProgress: [], // Em atendimento
      converted: [], // Convertidos (sucesso)
      disqualified: [], // Desqualificados (falha)
    };

    // Status distribution tracking
    const statusDistribution = {};
    const now = new Date();

    leads.forEach(lead => {
      const status = statusMap[lead.STATUS_ID];
      const statusId = lead.STATUS_ID || 'UNKNOWN';
      const statusName = status?.NAME || statusId;

      // Track status distribution
      if (!statusDistribution[statusId]) {
        statusDistribution[statusId] = {
          id: statusId,
          name: statusName,
          count: 0,
          semantic: status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID || 'P',
          avgDaysInStatus: 0,
          totalDaysInStatus: 0,
        };
      }
      statusDistribution[statusId].count++;

      // Calculate days in current status
      if (lead.DATE_MODIFY) {
        const lastModified = new Date(lead.DATE_MODIFY);
        const daysInStatus = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
        statusDistribution[statusId].totalDaysInStatus += daysInStatus;
      }

      if (!status) {
        categorized.new.push(lead);
        return;
      }

      // Semântica de status do Bitrix24
      // STATUS_SEMANTIC_ID: P (em processo), S (sucesso), F (falha)
      const semantic = status.EXTRA?.SEMANTICS || status.STATUS_SEMANTIC_ID;

      if (semantic === 'S' || lead.STATUS_ID === 'CONVERTED') {
        categorized.converted.push(lead);
      } else if (semantic === 'F' || lead.STATUS_ID === 'JUNK') {
        categorized.disqualified.push(lead);
      } else if (lead.STATUS_ID === 'NEW') {
        categorized.new.push(lead);
      } else {
        categorized.inProgress.push(lead);
      }
    });

    // Calculate average days in status
    Object.values(statusDistribution).forEach(status => {
      if (status.count > 0) {
        status.avgDaysInStatus = Math.round(status.totalDaysInStatus / status.count);
      }
      delete status.totalDaysInStatus; // Remove internal tracking field
    });

    // Análise por origem do lead (campo UF_CRM_1692640693814)
    const byOrigemLead = {};
    leads.forEach(lead => {
      const origemId = lead.UF_CRM_1692640693814 || 'NAO_PREENCHIDO';
      const origemName = this.getOrigemLeadName(origemId === 'NAO_PREENCHIDO' ? null : origemId);

      if (!byOrigemLead[origemId]) {
        byOrigemLead[origemId] = {
          id: origemId,
          name: origemName,
          total: 0,
          converted: 0,
          disqualified: 0,
          inProgress: 0,
          value: 0,
        };
      }

      byOrigemLead[origemId].total++;
      byOrigemLead[origemId].value += parseFloat(lead.OPPORTUNITY) || 0;

      const status = statusMap[lead.STATUS_ID];
      const semantic = status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID;

      if (semantic === 'S' || lead.STATUS_ID === 'CONVERTED') {
        byOrigemLead[origemId].converted++;
      } else if (semantic === 'F' || lead.STATUS_ID === 'JUNK') {
        byOrigemLead[origemId].disqualified++;
      } else {
        byOrigemLead[origemId].inProgress++;
      }
    });

    // Análise por SOURCE_ID legado (mantido para compatibilidade)
    const bySource = {};
    leads.forEach(lead => {
      const sourceId = lead.SOURCE_ID || 'UNKNOWN';
      const sourceName = sourceMap[sourceId]?.NAME || lead.SOURCE_DESCRIPTION || 'Não identificado';

      if (!bySource[sourceId]) {
        bySource[sourceId] = {
          id: sourceId,
          name: sourceName,
          total: 0,
          converted: 0,
          disqualified: 0,
          inProgress: 0,
          value: 0,
        };
      }

      bySource[sourceId].total++;
      bySource[sourceId].value += parseFloat(lead.OPPORTUNITY) || 0;

      const status = statusMap[lead.STATUS_ID];
      const semantic = status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID;

      if (semantic === 'S' || lead.STATUS_ID === 'CONVERTED') {
        bySource[sourceId].converted++;
      } else if (semantic === 'F' || lead.STATUS_ID === 'JUNK') {
        bySource[sourceId].disqualified++;
      } else {
        bySource[sourceId].inProgress++;
      }
    });

    // Análise por UTM Source
    const byUtmSource = {};
    const byUtmMedium = {};
    const byUtmCampaign = {};

    leads.forEach(lead => {
      const utmSource = lead.UTM_SOURCE || 'Sem UTM';
      const utmMedium = lead.UTM_MEDIUM || 'Sem Medium';
      const utmCampaign = lead.UTM_CAMPAIGN || 'Sem Campanha';

      const status = statusMap[lead.STATUS_ID];
      const semantic = status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID;
      const isConverted = semantic === 'S' || lead.STATUS_ID === 'CONVERTED';
      const isDisqualified = semantic === 'F' || lead.STATUS_ID === 'JUNK';

      // Análise por UTM Source
      if (!byUtmSource[utmSource]) {
        byUtmSource[utmSource] = {
          source: utmSource,
          total: 0,
          converted: 0,
          disqualified: 0,
          inProgress: 0,
          campaigns: {},
        };
      }

      byUtmSource[utmSource].total++;
      if (isConverted) {
        byUtmSource[utmSource].converted++;
      } else if (isDisqualified) {
        byUtmSource[utmSource].disqualified++;
      } else {
        byUtmSource[utmSource].inProgress++;
      }

      // Análise por campanha dentro da fonte
      if (!byUtmSource[utmSource].campaigns[utmCampaign]) {
        byUtmSource[utmSource].campaigns[utmCampaign] = { total: 0, converted: 0, disqualified: 0 };
      }
      byUtmSource[utmSource].campaigns[utmCampaign].total++;
      if (isConverted) {
        byUtmSource[utmSource].campaigns[utmCampaign].converted++;
      } else if (isDisqualified) {
        byUtmSource[utmSource].campaigns[utmCampaign].disqualified++;
      }

      // Análise por UTM Medium
      if (!byUtmMedium[utmMedium]) {
        byUtmMedium[utmMedium] = {
          medium: utmMedium,
          total: 0,
          converted: 0,
          disqualified: 0,
          inProgress: 0,
        };
      }
      byUtmMedium[utmMedium].total++;
      if (isConverted) {
        byUtmMedium[utmMedium].converted++;
      } else if (isDisqualified) {
        byUtmMedium[utmMedium].disqualified++;
      } else {
        byUtmMedium[utmMedium].inProgress++;
      }

      // Análise por UTM Campaign (independente de source)
      if (!byUtmCampaign[utmCampaign]) {
        byUtmCampaign[utmCampaign] = {
          campaign: utmCampaign,
          total: 0,
          converted: 0,
          disqualified: 0,
          inProgress: 0,
          sources: {},
        };
      }
      byUtmCampaign[utmCampaign].total++;
      if (isConverted) {
        byUtmCampaign[utmCampaign].converted++;
      } else if (isDisqualified) {
        byUtmCampaign[utmCampaign].disqualified++;
      } else {
        byUtmCampaign[utmCampaign].inProgress++;
      }

      // Track sources within campaigns
      if (!byUtmCampaign[utmCampaign].sources[utmSource]) {
        byUtmCampaign[utmCampaign].sources[utmSource] = { total: 0, converted: 0 };
      }
      byUtmCampaign[utmCampaign].sources[utmSource].total++;
      if (isConverted) {
        byUtmCampaign[utmCampaign].sources[utmSource].converted++;
      }
    });

    // Análise por hora de chegada
    const byHour = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    leads.forEach(lead => {
      if (lead.DATE_CREATE) {
        const hour = new Date(lead.DATE_CREATE).getHours();
        byHour[hour].count++;
      }
    });

    // Heatmap: análise por dia da semana e hora
    const heatmapData = [];
    leads.forEach(lead => {
      if (lead.DATE_CREATE) {
        const date = new Date(lead.DATE_CREATE);
        const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
        const hour = date.getHours();
        heatmapData.push({ hour, dayOfWeek, value: 1 });
      }
    });

    // Agregar heatmap data
    const heatmapAggregated = {};
    heatmapData.forEach(item => {
      const key = `${item.dayOfWeek}-${item.hour}`;
      if (!heatmapAggregated[key]) {
        heatmapAggregated[key] = { hour: item.hour, dayOfWeek: item.dayOfWeek, value: 0 };
      }
      heatmapAggregated[key].value++;
    });

    // Tempo médio de conversão (dias entre criação e conversão)
    let totalConversionDays = 0;
    let conversionCount = 0;
    categorized.converted.forEach(lead => {
      if (lead.DATE_CREATE && lead.DATE_CLOSED) {
        const created = new Date(lead.DATE_CREATE);
        const closed = new Date(lead.DATE_CLOSED);
        const days = Math.floor((closed - created) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days < 365) { // Ignorar valores absurdos
          totalConversionDays += days;
          conversionCount++;
        }
      }
    });
    const avgConversionDays = conversionCount > 0 ? totalConversionDays / conversionCount : 0;

    // Tempo médio em atendimento (leads não convertidos)
    let totalInProgressDays = 0;
    let inProgressCount = 0;
    categorized.inProgress.forEach(lead => {
      if (lead.DATE_CREATE) {
        const created = new Date(lead.DATE_CREATE);
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days < 365) {
          totalInProgressDays += days;
          inProgressCount++;
        }
      }
    });
    const avgInProgressDays = inProgressCount > 0 ? totalInProgressDays / inProgressCount : 0;

    return {
      total: leads.length,
      categorized: {
        new: categorized.new.length,
        inProgress: categorized.inProgress.length,
        converted: categorized.converted.length,
        disqualified: categorized.disqualified.length,
      },
      conversionRate: leads.length > 0
        ? ((categorized.converted.length / leads.length) * 100).toFixed(2)
        : 0,
      byOrigemLead: Object.values(byOrigemLead).sort((a, b) => b.total - a.total),
      bySource: Object.values(bySource).sort((a, b) => b.total - a.total),
      byUtmSource: Object.values(byUtmSource).sort((a, b) => b.total - a.total),
      byUtmMedium: Object.values(byUtmMedium).sort((a, b) => b.total - a.total),
      byUtmCampaign: Object.values(byUtmCampaign).sort((a, b) => b.total - a.total),
      statusDistribution: Object.values(statusDistribution).sort((a, b) => b.count - a.count),
      byHour,
      heatmap: Object.values(heatmapAggregated),
      metrics: {
        avgConversionDays: Math.round(avgConversionDays * 10) / 10,
        avgInProgressDays: Math.round(avgInProgressDays * 10) / 10,
        totalConverted: categorized.converted.length,
        totalDisqualified: categorized.disqualified.length,
      },
      statuses,
      sources,
      origemLeadMap: ORIGEM_LEAD_MAP,
      rawLeads: leads,
    };
  }

  async getDealsAnalytics(startDate, endDate) {
    const deals = await this.getDealsByDateRange(startDate, endDate);
    const stages = await this.getDealStages();
    const categories = await this.getDealCategories();

    const stageMap = {};
    stages.forEach(s => { stageMap[s.STATUS_ID] = s; });

    // Análise por estágio
    const byStage = {};
    deals.forEach(deal => {
      const stageId = deal.STAGE_ID || 'UNKNOWN';
      const stageName = stageMap[stageId]?.NAME || stageId;

      if (!byStage[stageId]) {
        byStage[stageId] = {
          id: stageId,
          name: stageName,
          count: 0,
          value: 0,
        };
      }

      byStage[stageId].count++;
      byStage[stageId].value += parseFloat(deal.OPPORTUNITY) || 0;
    });

    // Calcular total de vendas (deals ganhos)
    const wonDeals = deals.filter(d => {
      const stage = stageMap[d.STAGE_ID];
      return stage?.EXTRA?.SEMANTICS === 'S' ||
             d.STAGE_ID?.includes('WON') ||
             d.STAGE_ID?.includes('FINAL_INVOICE');
    });

    const totalRevenue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.OPPORTUNITY) || 0), 0);
    const totalPotential = deals.reduce((sum, d) => sum + (parseFloat(d.OPPORTUNITY) || 0), 0);

    return {
      total: deals.length,
      won: wonDeals.length,
      totalRevenue,
      totalPotential,
      averageTicket: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
      byStage: Object.values(byStage),
      stages,
      categories,
      rawDeals: deals,
    };
  }
}

export default new Bitrix24Service();
