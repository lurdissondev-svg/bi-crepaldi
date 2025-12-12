import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

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
    const allItems = [];
    let start = 0;
    const batchSize = 50;

    while (true) {
      const response = await this.callMethod(method, { ...params, start });
      const items = response.result || [];
      allItems.push(...items);

      if (maxItems && allItems.length >= maxItems) {
        return allItems.slice(0, maxItems);
      }

      if (!response.next || items.length < batchSize) {
        break;
      }

      start = response.next;
      // Delay maior para evitar rate limiting (503)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allItems;
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

    leads.forEach(lead => {
      const status = statusMap[lead.STATUS_ID];
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

    // Análise por origem (source)
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
    leads.forEach(lead => {
      const utmSource = lead.UTM_SOURCE || 'Sem UTM';

      if (!byUtmSource[utmSource]) {
        byUtmSource[utmSource] = {
          source: utmSource,
          total: 0,
          converted: 0,
          disqualified: 0,
          campaigns: {},
        };
      }

      byUtmSource[utmSource].total++;

      const status = statusMap[lead.STATUS_ID];
      const semantic = status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID;

      if (semantic === 'S' || lead.STATUS_ID === 'CONVERTED') {
        byUtmSource[utmSource].converted++;
      } else if (semantic === 'F' || lead.STATUS_ID === 'JUNK') {
        byUtmSource[utmSource].disqualified++;
      }

      // Análise por campanha
      const campaign = lead.UTM_CAMPAIGN || 'Sem Campanha';
      if (!byUtmSource[utmSource].campaigns[campaign]) {
        byUtmSource[utmSource].campaigns[campaign] = { total: 0, converted: 0 };
      }
      byUtmSource[utmSource].campaigns[campaign].total++;
      if (semantic === 'S' || lead.STATUS_ID === 'CONVERTED') {
        byUtmSource[utmSource].campaigns[campaign].converted++;
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
      bySource: Object.values(bySource).sort((a, b) => b.total - a.total),
      byUtmSource: Object.values(byUtmSource).sort((a, b) => b.total - a.total),
      byHour,
      statuses,
      sources,
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
