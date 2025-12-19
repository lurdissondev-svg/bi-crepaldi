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

// Mapeamento do campo "Campanha" (UF_CRM_1729176132205)
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

// Mapeamento do campo "Profissional" (UF_CRM_1697468634) - IBLOCK 32
const PROFISSIONAIS_MAP = {
  '266': 'DRA NATASHA',
  '268': 'DRA KELLY DA CAS',
  '1000': 'LETYCIA OLIVEIRA',
  '1002': 'EVELIM',
  '1004': 'THALITA',
  '1006': 'DRA ELIZABETH VAZ',
  '1010': 'CINTYA',
  '1012': 'DANIELA',
  '1014': 'NADYA RIBEIRO',
  '6546': 'DR PAULO',
  '6634': 'OUTRO',
  '6636': 'MARIA APARECIDA ALCE DE SOUZA',
  '6658': 'COMPRA DE VOUCHER',
  '7008': 'SEM PROFISSIONAL',
  '7816': 'LUANA DA SILVA BARBOSA',
  '7840': 'DR ANDERSON ANDREU CUNHA',
  '7960': 'ANNY KAROLLINY',
  '8232': 'AMANDA RAFAELA FINKLER',
  '8234': 'EMILLY QUERINA PEGORARI',
  '8348': 'DRA. DAYANE CRISTINA LEMBO DA COSTA',
  '8512': 'AMANDA MARIA - NUTROLOGIA',
  '8514': 'DRA. KLAYNE MOURA',
  '9038': 'TAIRANE DE SOUZA MORAES',
};

// Mapeamento do campo "Motivo de desqualificação" (UF_CRM_1695041103) - CAMPO ANTIGO
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
};

// Mapeamento do campo "Desqualificado" (UF_CRM_1748611226066) - CAMPO CORRETO/NOVO
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
};

class Bitrix24Service {
  constructor() {
    this.baseUrl = config.bitrix24.webhookUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2 minutos para suportar sync de muitos leads
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.origemLeadMap = ORIGEM_LEAD_MAP;
    this.campanhaMap = CAMPANHA_MAP;
    this.profissionaisMap = PROFISSIONAIS_MAP;
    this.motivoDesqualificacaoMap = MOTIVO_DESQUALIFICACAO_MAP;
    this.desqualificadoMap = DESQUALIFICADO_MAP;

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

  // Método para obter o nome da campanha pelo ID
  getCampanhaName(campanhaId) {
    if (!campanhaId) return 'Não preenchido';
    return CAMPANHA_MAP[String(campanhaId)] || 'Não identificado';
  }

  // Método para obter o nome do motivo de desqualificação pelo ID
  getMotivoDesqualificacaoName(motivoId) {
    if (!motivoId) return 'Não preenchido';
    return MOTIVO_DESQUALIFICACAO_MAP[String(motivoId)] || 'Não identificado';
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

  // Busca deals WON e retorna os LEAD_IDs associados
  async getDealsWonByLeads(startDate, endDate) {
    try {
      // Buscar todos os stages de todas as categorias para identificar WON
      const allStages = [];
      const categories = await this.getDealCategories();

      // Buscar stages da categoria padrão (0)
      const defaultStages = await this.getDealStages(0);
      allStages.push(...defaultStages);

      // Buscar stages das outras categorias
      for (const cat of categories) {
        if (cat.id !== 0) {
          const stages = await this.getDealStages(cat.id);
          allStages.push(...stages);
        }
      }

      // Mapear stages WON (semantic = S ou contém WON)
      const wonStageIds = allStages
        .filter(s => s.EXTRA?.SEMANTICS === 'S' || s.STATUS_ID?.includes('WON'))
        .map(s => s.STATUS_ID);

      if (wonStageIds.length === 0) {
        logger.warn('[Bitrix24 Service] Nenhum estágio WON encontrado');
        return { leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0 };
      }

      // Buscar deals WON no período
      const deals = await this.getAllPaginated('crm.deal.list', {
        filter: {
          '>=DATE_CREATE': startDate,
          '<=DATE_CREATE': endDate,
          'STAGE_ID': wonStageIds,
        },
        select: ['ID', 'LEAD_ID', 'OPPORTUNITY', 'STAGE_ID', 'DATE_CREATE'],
      });

      // Extrair LEAD_IDs únicos dos deals WON
      const leadsComDealWon = [...new Set(
        deals
          .filter(d => d.LEAD_ID)
          .map(d => String(d.LEAD_ID))
      )];

      const wonDealsValue = deals.reduce((sum, d) => sum + (parseFloat(d.OPPORTUNITY) || 0), 0);

      logger.info(`[Bitrix24 Service] Encontrados ${deals.length} deals WON vinculados a ${leadsComDealWon.length} leads`);

      return {
        leadsComDealWon,
        wonDealsCount: deals.length,
        wonDealsValue,
      };
    } catch (error) {
      logger.error('[Bitrix24 Service] Erro ao buscar deals WON:', error.message);
      return { leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0 };
    }
  }

  async getLeadsAnalytics(startDate, endDate) {
    const leads = await this.getLeadsByDateRange(startDate, endDate);
    const statuses = await this.getLeadStatuses();
    const sources = await this.getLeadSources();

    // Buscar deals WON para calcular conversão real
    const dealsWon = await this.getDealsWonByLeads(startDate, endDate);

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

    // Análise por Campanha Bitrix (campo UF_CRM_1729176132205)
    // Set de leads com deal WON para lookup rápido
    const leadsComDealWonSet = new Set(dealsWon.leadsComDealWon);

    const byCampanhaBitrix = {};
    leads.forEach(lead => {
      const campanhaId = lead.UF_CRM_1729176132205 || 'NAO_PREENCHIDO';
      const campanhaName = this.getCampanhaName(campanhaId === 'NAO_PREENCHIDO' ? null : campanhaId);
      const leadId = String(lead.ID);

      if (!byCampanhaBitrix[campanhaId]) {
        byCampanhaBitrix[campanhaId] = {
          id: campanhaId,
          name: campanhaName,
          total: 0,
          agendados: 0,     // Lead CONVERTED (agendou consulta)
          convertidos: 0,   // Deal WON (negócio fechado)
          desqualificados: 0,
          emAndamento: 0,
          value: 0,
        };
      }

      byCampanhaBitrix[campanhaId].total++;
      byCampanhaBitrix[campanhaId].value += parseFloat(lead.OPPORTUNITY) || 0;

      // Agendados = CONVERTED
      if (lead.STATUS_ID === 'CONVERTED') {
        byCampanhaBitrix[campanhaId].agendados++;
      }

      // Convertidos = Deal WON
      if (leadsComDealWonSet.has(leadId)) {
        byCampanhaBitrix[campanhaId].convertidos++;
      }

      // Desqualificados
      if (lead.STATUS_ID === 'JUNK') {
        byCampanhaBitrix[campanhaId].desqualificados++;
      }

      // Em andamento (não agendou, não desqualificou, não converteu)
      const status = statusMap[lead.STATUS_ID];
      const semantic = status?.EXTRA?.SEMANTICS || status?.STATUS_SEMANTIC_ID;
      if (semantic !== 'S' && semantic !== 'F' && lead.STATUS_ID !== 'CONVERTED' && lead.STATUS_ID !== 'JUNK') {
        byCampanhaBitrix[campanhaId].emAndamento++;
      }
    });

    // Análise por Motivo de Desqualificação (campo UF_CRM_1695041103)
    // Apenas para leads desqualificados que tenham motivo preenchido
    const byMotivoDesqualificacao = {};
    categorized.disqualified.forEach(lead => {
      const motivoId = lead.UF_CRM_1695041103 || 'NAO_PREENCHIDO';
      const motivoName = this.getMotivoDesqualificacaoName(motivoId === 'NAO_PREENCHIDO' ? null : motivoId);

      if (!byMotivoDesqualificacao[motivoId]) {
        byMotivoDesqualificacao[motivoId] = {
          id: motivoId,
          name: motivoName,
          count: 0,
        };
      }
      byMotivoDesqualificacao[motivoId].count++;
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

    // Taxa de conversão real (baseada em deals WON)
    const realConversionRate = leads.length > 0
      ? ((dealsWon.leadsComDealWon.length / leads.length) * 100).toFixed(2)
      : 0;

    return {
      total: leads.length,
      categorized: {
        new: categorized.new.length,
        inProgress: categorized.inProgress.length,
        converted: categorized.converted.length, // Agendados
        disqualified: categorized.disqualified.length,
        dealWon: dealsWon.leadsComDealWon.length, // Conversão real
      },
      conversionRate: leads.length > 0
        ? ((categorized.converted.length / leads.length) * 100).toFixed(2)
        : 0,
      realConversionRate, // Taxa baseada em negócios fechados
      byOrigemLead: Object.values(byOrigemLead).sort((a, b) => b.total - a.total),
      bySource: Object.values(bySource).sort((a, b) => b.total - a.total),
      byUtmSource: Object.values(byUtmSource).sort((a, b) => b.total - a.total),
      byUtmMedium: Object.values(byUtmMedium).sort((a, b) => b.total - a.total),
      byUtmCampaign: Object.values(byUtmCampaign).sort((a, b) => b.total - a.total),
      byCampanhaBitrix: Object.values(byCampanhaBitrix).sort((a, b) => b.total - a.total),
      byMotivoDesqualificacao: Object.values(byMotivoDesqualificacao).sort((a, b) => b.count - a.count),
      statusDistribution: Object.values(statusDistribution).sort((a, b) => b.count - a.count),
      byHour,
      heatmap: Object.values(heatmapAggregated),
      metrics: {
        avgConversionDays: Math.round(avgConversionDays * 10) / 10,
        avgInProgressDays: Math.round(avgInProgressDays * 10) / 10,
        totalConverted: categorized.converted.length, // Agendados
        totalDisqualified: categorized.disqualified.length,
        totalDealWon: dealsWon.leadsComDealWon.length, // Conversão real
        wonDealsValue: dealsWon.wonDealsValue,
      },
      statuses,
      sources,
      origemLeadMap: ORIGEM_LEAD_MAP,
      campanhaMap: CAMPANHA_MAP,
      motivoDesqualificacaoMap: MOTIVO_DESQUALIFICACAO_MAP,
      rawLeads: leads,
      leadsComDealWon: dealsWon.leadsComDealWon, // Lista de IDs para o frontend
    };
  }

  /**
   * Busca deals perdidos e agrupa por motivo de desqualificação (UF_CRM_1695041103)
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} { byMotivoDesqualificacao: Array, lostDealsCount: number }
   */
  async getDealsLostByMotivoDesqualificacao(startDate, endDate) {
    try {
      // Buscar todos os stages de todas as categorias para identificar LOST
      const allStages = [];
      const categories = await this.getDealCategories();

      // Buscar stages da categoria padrão (0)
      const defaultStages = await this.getDealStages(0);
      allStages.push(...defaultStages);

      // Buscar stages das outras categorias
      for (const cat of categories) {
        if (cat.id !== 0) {
          const stages = await this.getDealStages(cat.id);
          allStages.push(...stages);
        }
      }

      // Mapear stages LOST (semantic = F ou contém LOSE)
      const lostStageIds = allStages
        .filter(s => s.EXTRA?.SEMANTICS === 'F' || s.STATUS_ID?.includes('LOSE'))
        .map(s => s.STATUS_ID);

      if (lostStageIds.length === 0) {
        logger.warn('[Bitrix24 Service] Nenhum estágio LOST encontrado');
        return { byMotivoDesqualificacao: [], lostDealsCount: 0 };
      }

      // Buscar deals LOST no período
      const deals = await this.getAllPaginated('crm.deal.list', {
        filter: {
          '>=DATE_CREATE': startDate,
          '<=DATE_CREATE': endDate,
          'STAGE_ID': lostStageIds,
        },
        select: ['ID', 'TITLE', 'OPPORTUNITY', 'STAGE_ID', 'DATE_CREATE', 'UF_CRM_1695041103'],
      });

      // Agrupar por motivo de desqualificação
      const byMotivoDesqualificacao = {};
      deals.forEach(deal => {
        const motivoId = deal.UF_CRM_1695041103 || 'NAO_PREENCHIDO';
        const motivoName = this.getMotivoDesqualificacaoName(motivoId === 'NAO_PREENCHIDO' ? null : motivoId);

        if (!byMotivoDesqualificacao[motivoId]) {
          byMotivoDesqualificacao[motivoId] = {
            id: motivoId,
            name: motivoName,
            count: 0,
            value: 0,
          };
        }
        byMotivoDesqualificacao[motivoId].count++;
        byMotivoDesqualificacao[motivoId].value += parseFloat(deal.OPPORTUNITY) || 0;
      });

      logger.info(`[Bitrix24 Service] Encontrados ${deals.length} deals LOST com motivos de desqualificação`);

      return {
        byMotivoDesqualificacao: Object.values(byMotivoDesqualificacao).sort((a, b) => b.count - a.count),
        lostDealsCount: deals.length,
      };
    } catch (error) {
      logger.error('[Bitrix24 Service] Erro ao buscar deals LOST por motivo:', error.message);
      return { byMotivoDesqualificacao: [], lostDealsCount: 0 };
    }
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

    // Análise por profissional - APENAS deals fechados (WON)
    const byProfissional = {};

    wonDeals.forEach(deal => {
      const profIds = deal.UF_CRM_1697468634;
      if (profIds && Array.isArray(profIds) && profIds.length > 0) {
        profIds.forEach(profId => {
          const profIdStr = String(profId);
          const profName = this.profissionaisMap[profIdStr] || `Profissional ${profIdStr}`;

          if (!byProfissional[profIdStr]) {
            byProfissional[profIdStr] = {
              id: profIdStr,
              nome: profName,
              vendas: 0,
              valor: 0,
            };
          }
          byProfissional[profIdStr].vendas++;
          byProfissional[profIdStr].valor += parseFloat(deal.OPPORTUNITY) || 0;
        });
      }
    });

    const totalRevenue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.OPPORTUNITY) || 0), 0);
    const totalPotential = deals.reduce((sum, d) => sum + (parseFloat(d.OPPORTUNITY) || 0), 0);

    // Ordenar profissionais por valor
    const profissionais = Object.values(byProfissional)
      .filter(p => p.nome !== 'COMPRA DE VOUCHER' && p.nome !== 'SEM PROFISSIONAL')
      .sort((a, b) => b.valor - a.valor);

    return {
      total: deals.length,
      won: wonDeals.length,
      totalRevenue,
      totalPotential,
      averageTicket: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
      byStage: Object.values(byStage),
      profissionais,
      stages,
      categories,
      rawDeals: deals,
    };
  }

  // Método para obter nome do profissional pelo ID
  getProfissionalName(profId) {
    return this.profissionaisMap[String(profId)] || `Profissional ${profId}`;
  }

  // ==================== STAGE HISTORY ====================

  /**
   * Busca histórico de mudanças de estágio de leads ou deals
   * Usa o endpoint crm.stagehistory.list para obter transições de estágio
   *
   * @param {number} entityTypeId - 1 = Lead, 2 = Deal
   * @param {string} startDate - Data início (formato YYYY-MM-DD)
   * @param {string} endDate - Data fim (formato YYYY-MM-DD)
   * @returns {Array} Lista de transições de estágio
   */
  async getStageHistory(entityTypeId = 1, startDate, endDate) {
    const cacheKey = this.getCacheKey('stagehistory', { entityTypeId, startDate, endDate });

    // Verifica cache primeiro
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug(`[Bitrix Stage History Cache HIT] ${cacheKey}`);
      return cached;
    }

    logger.info(`[Bitrix24 Service] Buscando histórico de estágios (entityTypeId=${entityTypeId}) de ${startDate} a ${endDate}`);

    try {
      const allItems = [];
      let start = 0;

      while (true) {
        const response = await this.callMethod('crm.stagehistory.list', {
          entityTypeId,
          filter: {
            '>=CREATED_TIME': startDate,
            '<=CREATED_TIME': endDate,
          },
          order: { CREATED_TIME: 'ASC' },
          start,
        });

        const items = response.result?.items || [];
        allItems.push(...items);

        if (!response.result?.next || items.length === 0) {
          break;
        }

        start = response.result.next;
        // Delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      logger.info(`[Bitrix24 Service] Encontradas ${allItems.length} transições de estágio`);

      // Cache por 5 minutos (histórico muda menos frequentemente)
      this.cache.set(cacheKey, allItems, 300);
      return allItems;
    } catch (error) {
      logger.error('[Bitrix24 Service] Erro ao buscar histórico de estágios:', error.message);
      return [];
    }
  }

  /**
   * Calcula métricas de tempo de conversão baseadas no histórico de estágios
   * @param {string} startDate - Data início
   * @param {string} endDate - Data fim
   * @returns {Object} Métricas de conversão
   */
  async getConversionTimeMetrics(startDate, endDate) {
    const stageHistory = await this.getStageHistory(1, startDate, endDate);
    const leads = await this.getLeadsByDateRange(startDate, endDate);

    if (stageHistory.length === 0) {
      logger.warn('[Bitrix24 Service] Nenhum histórico de estágios encontrado, usando cálculo alternativo');
      // Fallback: calcular baseado em DATE_CLOSED dos leads
      return this.calculateConversionTimeFromLeads(leads);
    }

    // Agrupar transições por lead
    const transitionsByLead = {};
    stageHistory.forEach(item => {
      const leadId = String(item.OWNER_ID);
      if (!transitionsByLead[leadId]) {
        transitionsByLead[leadId] = [];
      }
      transitionsByLead[leadId].push({
        stageId: item.STAGE_ID,
        semantics: item.STAGE_SEMANTIC_ID,
        createdTime: new Date(item.CREATED_TIME),
      });
    });

    // Calcular tempo médio para cada estágio
    const stageTimings = {};
    const conversionTimes = [];
    const inProgressTimes = [];
    const now = new Date();

    Object.entries(transitionsByLead).forEach(([leadId, transitions]) => {
      // Ordenar por tempo
      transitions.sort((a, b) => a.createdTime - b.createdTime);

      // Encontrar primeira transição (criação) e transição final
      const firstTransition = transitions[0];
      const lastTransition = transitions[transitions.length - 1];

      // Se o lead foi convertido (sucesso)
      if (lastTransition.semantics === 'S') {
        const conversionDays = (lastTransition.createdTime - firstTransition.createdTime) / (1000 * 60 * 60 * 24);
        if (conversionDays >= 0 && conversionDays < 365) {
          conversionTimes.push(conversionDays);
        }
      }
      // Se ainda está em progresso
      else if (lastTransition.semantics === 'P') {
        const inProgressDays = (now - firstTransition.createdTime) / (1000 * 60 * 60 * 24);
        if (inProgressDays >= 0 && inProgressDays < 365) {
          inProgressTimes.push(inProgressDays);
        }
      }

      // Calcular tempo em cada estágio
      for (let i = 0; i < transitions.length - 1; i++) {
        const current = transitions[i];
        const next = transitions[i + 1];
        const timeInStage = (next.createdTime - current.createdTime) / (1000 * 60 * 60 * 24);

        if (!stageTimings[current.stageId]) {
          stageTimings[current.stageId] = { total: 0, count: 0 };
        }
        stageTimings[current.stageId].total += timeInStage;
        stageTimings[current.stageId].count++;
      }
    });

    // Calcular médias
    const avgConversionDays = conversionTimes.length > 0
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      : 0;

    const avgInProgressDays = inProgressTimes.length > 0
      ? inProgressTimes.reduce((a, b) => a + b, 0) / inProgressTimes.length
      : 0;

    // Calcular tempo médio por estágio
    const avgTimeByStage = {};
    Object.entries(stageTimings).forEach(([stageId, data]) => {
      avgTimeByStage[stageId] = data.count > 0 ? data.total / data.count : 0;
    });

    return {
      avgConversionDays: Math.round(avgConversionDays * 10) / 10,
      avgInProgressDays: Math.round(avgInProgressDays * 10) / 10,
      totalAnalyzed: Object.keys(transitionsByLead).length,
      totalConverted: conversionTimes.length,
      totalInProgress: inProgressTimes.length,
      avgTimeByStage,
      conversionTimeDistribution: this.calculateDistribution(conversionTimes),
    };
  }

  /**
   * Fallback: calcula tempo de conversão baseado em DATE_CLOSED dos leads
   */
  calculateConversionTimeFromLeads(leads) {
    const conversionTimes = [];
    const inProgressTimes = [];
    const now = new Date();

    leads.forEach(lead => {
      if (!lead.DATE_CREATE) return;

      const created = new Date(lead.DATE_CREATE);

      // Se foi convertido
      if ((lead.STATUS_ID === 'CONVERTED' || lead.status_semantica === 'success') && lead.DATE_CLOSED) {
        const closed = new Date(lead.DATE_CLOSED);
        const days = (closed - created) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) {
          conversionTimes.push(days);
        }
      }
      // Se ainda está em progresso
      else if (lead.STATUS_ID !== 'JUNK' && lead.status_semantica !== 'failure') {
        const days = (now - created) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) {
          inProgressTimes.push(days);
        }
      }
    });

    const avgConversionDays = conversionTimes.length > 0
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      : 0;

    const avgInProgressDays = inProgressTimes.length > 0
      ? inProgressTimes.reduce((a, b) => a + b, 0) / inProgressTimes.length
      : 0;

    return {
      avgConversionDays: Math.round(avgConversionDays * 10) / 10,
      avgInProgressDays: Math.round(avgInProgressDays * 10) / 10,
      totalAnalyzed: leads.length,
      totalConverted: conversionTimes.length,
      totalInProgress: inProgressTimes.length,
      avgTimeByStage: {},
      conversionTimeDistribution: this.calculateDistribution(conversionTimes),
    };
  }

  /**
   * Calcula distribuição de tempos de conversão
   */
  calculateDistribution(times) {
    if (times.length === 0) return [];

    const buckets = [
      { label: '0-1 dia', min: 0, max: 1, count: 0 },
      { label: '2-3 dias', min: 2, max: 3, count: 0 },
      { label: '4-7 dias', min: 4, max: 7, count: 0 },
      { label: '8-14 dias', min: 8, max: 14, count: 0 },
      { label: '15-30 dias', min: 15, max: 30, count: 0 },
      { label: '31-60 dias', min: 31, max: 60, count: 0 },
      { label: '60+ dias', min: 61, max: Infinity, count: 0 },
    ];

    times.forEach(t => {
      const bucket = buckets.find(b => t >= b.min && t <= b.max);
      if (bucket) bucket.count++;
    });

    return buckets.map(b => ({
      label: b.label,
      count: b.count,
      percentage: times.length > 0 ? (b.count / times.length * 100).toFixed(1) : 0,
    }));
  }
}

export default new Bitrix24Service();
