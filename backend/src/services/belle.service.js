import axios from 'axios';
import NodeCache from 'node-cache';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { format, parse } from 'date-fns';

class BelleService {
  constructor() {
    this.baseUrl = config.belle.apiUrl;
    this.token = config.belle.token;
    this.estabelecimentos = config.belle.estabelecimentos;
    this.estabelecimentosMap = config.belle.estabelecimentosMap;

    // Cache para chamadas de API externas - TTL de 3 minutos
    this.cache = new NodeCache({
      stdTTL: 180,
      checkperiod: 60,
      useClones: false // Evita cópias desnecessárias para melhor performance
    });

    // Cache de chamadas em andamento para evitar duplicatas
    this.pendingRequests = new Map();

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // Reduzido para 60 segundos - timeout mais agressivo
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token,
      },
    });

    this.client.interceptors.request.use((config) => {
      logger.debug(`Belle API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Belle API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  // Gera uma chave de cache baseada nos parâmetros
  getCacheKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `belle:${endpoint}:${sortedParams}`;
  }

  // Faz requisição com cache e deduplicação de chamadas em andamento
  async cachedRequest(endpoint, params = {}, options = {}) {
    const cacheKey = this.getCacheKey(endpoint, params);

    // Verifica cache primeiro
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug(`[Cache HIT] ${cacheKey}`);
      return cached;
    }

    // Verifica se já há uma requisição em andamento para essa chave
    if (this.pendingRequests.has(cacheKey)) {
      logger.debug(`[Dedup] Aguardando requisição existente: ${cacheKey}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Inicia nova requisição
    logger.debug(`[Cache MISS] Buscando: ${cacheKey}`);

    const requestPromise = this.client.get(endpoint, { params, ...options })
      .then(response => {
        const data = response.data || [];
        // Salva no cache
        this.cache.set(cacheKey, data);
        // Remove da lista de pendentes
        this.pendingRequests.delete(cacheKey);
        return data;
      })
      .catch(error => {
        // Remove da lista de pendentes em caso de erro
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    // Registra como pendente
    this.pendingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  // Limpa cache - útil para forçar refresh
  clearCache() {
    this.cache.flushAll();
    logger.info('[Belle Service] Cache limpo');
  }

  // Formata data para o padrão Belle (dd/mm/yyyy)
  formatDateBelle(dateStr) {
    if (!dateStr) return '';
    try {
      // Se já estiver no formato dd/mm/yyyy, retorna
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

      // Se estiver no formato yyyy-MM-dd (ISO simples), converte diretamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }

      // Se estiver no formato ISO completo com timezone (2025-12-01T00:00:00-03:00)
      // Extrai apenas a parte yyyy-MM-dd para evitar problemas de timezone
      if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
        const [datePart] = dateStr.split('T');
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
      }

      // Outros formatos: usa date-fns parse para evitar problemas de timezone
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      return format(date, 'dd/MM/yyyy');
    } catch (e) {
      return dateStr;
    }
  }

  // ==================== CLIENTES ====================

  async getClientes(codEstab, pagina = 0) {
    try {
      const response = await this.client.get('/clientes', {
        params: {
          codEstab,
          pagina,
        },
      });
      return response.data || [];
    } catch (error) {
      logger.error(`Erro ao buscar clientes (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  async getClienteById(codEstab, clienteId) {
    try {
      const response = await this.client.get('/cliente/listar', {
        params: {
          codEstab,
          id: clienteId
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Erro ao buscar cliente ${clienteId}:`, error.message);
      return null;
    }
  }

  async getTodosClientes(codEstab) {
    const allClientes = [];
    let pagina = 0;
    let hasMore = true;

    while (hasMore) {
      const clientes = await this.getClientes(codEstab, pagina);
      if (clientes && clientes.length > 0) {
        allClientes.push(...clientes);
        pagina++;
        // API retorna 100 por página
        if (clientes.length < 100) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allClientes;
  }

  // ==================== VENDAS ====================

  async getVendas(codEstab, dataInicio, dataFim, params = {}) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/vendas', {
        estab: codEstab,
        dtInicio,
        dtFim,
        ...params,
      });
      return { data: data || [], total: data?.length || 0 };
    } catch (error) {
      logger.error(`Erro ao buscar vendas (estab ${codEstab}):`, error.message);
      return { data: [], total: 0 };
    }
  }

  async getVendasDetalhado(codEstab, dataInicio, dataFim, params = {}) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/vendas/detalhado', {
        estab: codEstab,
        dtInicio,
        dtFim,
        ...params,
      });
      return { data: data || [], total: data?.length || 0 };
    } catch (error) {
      logger.error(`Erro ao buscar vendas detalhado (estab ${codEstab}):`, error.message);
      return { data: [], total: 0 };
    }
  }

  async getVendasTodosEstabelecimentos(dataInicio, dataFim, params = {}) {
    const promises = this.estabelecimentos.map(codEstab =>
      this.getVendas(codEstab, dataInicio, dataFim, params)
        .then(result => ({
          codestab: codEstab,
          estabelecimento: this.estabelecimentosMap[codEstab],
          data: result.data,
          total: result.total
        }))
    );

    const results = await Promise.all(promises);
    return results;
  }

  // ==================== CONTAS A RECEBER ====================

  async getContasReceber(codEstab, dataInicio, dataFim, tipoData = 'lancamento') {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/contas_receber', {
        estab: codEstab,
        dtInicio,
        dtFim,
        tipoData,
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar contas a receber (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  // Busca TODAS as contas a receber SEM filtro de estabelecimento
  async getContasReceberTodos(dataInicio, dataFim, tipoData = 'lancamento') {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/contas_receber', {
        dtInicio,
        dtFim,
        tipoData,
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar todas as contas a receber:`, error.message);
      return [];
    }
  }

  // Calcula faturamento de TODAS as contas a receber (sem filtro de estab)
  // IMPORTANTE: Usa a data do FILTRO como referência, não a data interna do registro
  async getFaturamentoHoje(dataHoje) {
    try {
      // Busca contas a receber usando a data de hoje como filtro
      // A API Belle retorna registros baseados na data do filtro, independente do dt_lancamento interno
      const dados = await this.getContasReceberTodos(dataHoje, dataHoje, 'lancamento');

      let faturamentoTotal = 0;
      let quantidadeMovimentos = 0;

      if (Array.isArray(dados)) {
        dados.forEach(movimento => {
          // Apenas movimentos confirmados
          if (movimento.confirmado !== 'S') return;

          const valor = parseFloat(movimento.valor_bruto) || 0;
          faturamentoTotal += valor;
          quantidadeMovimentos++;
        });
      }

      return {
        faturamentoTotal,
        quantidadeMovimentos,
        dataReferencia: dataHoje,
      };
    } catch (error) {
      logger.error('Erro ao calcular faturamento de hoje:', error.message);
      return { faturamentoTotal: 0, quantidadeMovimentos: 0, dataReferencia: dataHoje };
    }
  }

  async getContasReceberTodosEstabelecimentos(dataInicio, dataFim, tipoData = 'lancamento') {
    const promises = this.estabelecimentos.map(codEstab =>
      this.getContasReceber(codEstab, dataInicio, dataFim, tipoData)
        .then(data => ({
          codestab: codEstab,
          estabelecimento: this.estabelecimentosMap[codEstab],
          data,
        }))
        .catch(() => ({
          codestab: codEstab,
          estabelecimento: this.estabelecimentosMap[codEstab],
          data: [],
        }))
    );

    return Promise.all(promises);
  }

  // Divide período em chunks de no máximo 3 meses (limite da API Belle)
  dividePeriodoEmChunks(dataInicio, dataFim) {
    const chunks = [];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    let chunkInicio = new Date(inicio);

    while (chunkInicio < fim) {
      // Calcula fim do chunk (máximo 3 meses)
      let chunkFim = new Date(chunkInicio);
      chunkFim.setMonth(chunkFim.getMonth() + 3);
      chunkFim.setDate(chunkFim.getDate() - 1); // Último dia do período

      // Se ultrapassou o fim desejado, usa o fim
      if (chunkFim > fim) {
        chunkFim = new Date(fim);
      }

      chunks.push({
        inicio: format(chunkInicio, 'yyyy-MM-dd'),
        fim: format(chunkFim, 'yyyy-MM-dd'),
      });

      // Próximo chunk começa no dia seguinte
      chunkInicio = new Date(chunkFim);
      chunkInicio.setDate(chunkInicio.getDate() + 1);
    }

    return chunks;
  }

  async getFaturamentoContasReceber(dataInicio, dataFim, estabelecimentosFiltro = []) {
    const estabs = estabelecimentosFiltro.length > 0
      ? estabelecimentosFiltro
      : this.estabelecimentos;

    // Divide o período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Para cada estabelecimento, busca todos os chunks
    const allPromises = [];
    for (const codEstab of estabs) {
      for (const chunk of chunks) {
        allPromises.push(
          this.getContasReceber(codEstab, chunk.inicio, chunk.fim, 'lancamento')
            .then(data => ({
              codestab: codEstab,
              estabelecimento: this.estabelecimentosMap[codEstab],
              data,
            }))
        );
      }
    }

    const resultados = await Promise.all(allPromises);

    // Consolidar dados
    let faturamentoTotal = 0;
    let quantidadeMovimentos = 0;
    const faturamentoDiario = {};
    const faturamentoPorEstabelecimento = {};
    const formasPagamentoMap = {};

    resultados.forEach(resultado => {
      const { codestab, estabelecimento, data } = resultado;

      if (!faturamentoPorEstabelecimento[codestab]) {
        faturamentoPorEstabelecimento[codestab] = {
          codestab,
          estabelecimento,
          valor: 0,
          quantidade: 0,
        };
      }

      if (Array.isArray(data)) {
        data.forEach(movimento => {
          // Apenas movimentos confirmados
          if (movimento.confirmado !== 'S') return;

          const valor = parseFloat(movimento.valor_bruto) || 0;
          faturamentoTotal += valor;
          quantidadeMovimentos++;
          faturamentoPorEstabelecimento[codestab].valor += valor;
          faturamentoPorEstabelecimento[codestab].quantidade++;

          // Agrupar por dia (dt_lancamento)
          const dataLancamento = movimento.dt_lancamento;
          if (dataLancamento) {
            if (!faturamentoDiario[dataLancamento]) {
              faturamentoDiario[dataLancamento] = { data: dataLancamento, valor: 0 };
            }
            faturamentoDiario[dataLancamento].valor += valor;
          }

          // Agrupar por forma de pagamento
          const formaPgto = movimento.nome_forma_pagamento || 'Outros';
          if (!formasPagamentoMap[formaPgto]) {
            formasPagamentoMap[formaPgto] = { nome: formaPgto, quantidade: 0, valor: 0 };
          }
          formasPagamentoMap[formaPgto].quantidade++;
          formasPagamentoMap[formaPgto].valor += valor;
        });
      }
    });

    const ticketMedio = quantidadeMovimentos > 0 ? faturamentoTotal / quantidadeMovimentos : 0;

    return {
      faturamentoTotal,
      quantidadeMovimentos,
      ticketMedio,
      faturamentoDiario: Object.values(faturamentoDiario).sort((a, b) => a.data.localeCompare(b.data)),
      formasPagamento: Object.values(formasPagamentoMap).sort((a, b) => b.valor - a.valor),
      porEstabelecimento: Object.values(faturamentoPorEstabelecimento),
    };
  }

  // ==================== FINANCEIRO ====================

  async getSaldoContas(codEstab, ano) {
    try {
      const response = await this.client.get('/financeiro/saldo_contas', {
        params: {
          codEstab,
          ano,
        },
      });
      return response.data || [];
    } catch (error) {
      logger.error(`Erro ao buscar saldo contas (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  async getPlanoContas() {
    try {
      const response = await this.client.get('/financeiro/plano_contas');
      return response.data || [];
    } catch (error) {
      logger.error('Erro ao buscar plano de contas:', error.message);
      return [];
    }
  }

  async getFormasPagamento() {
    try {
      const response = await this.client.get('/financeiro/formas_pagamento');
      return response.data || [];
    } catch (error) {
      logger.error('Erro ao buscar formas de pagamento:', error.message);
      return [];
    }
  }

  // ==================== ANALYTICS CONSOLIDADOS ====================

  async getAnalyticsFaturamento(dataInicio, dataFim, estabelecimentosFiltro = []) {
    const estabs = estabelecimentosFiltro.length > 0
      ? estabelecimentosFiltro
      : this.estabelecimentos;

    // Buscar dados de todos os estabelecimentos em paralelo
    const vendasPromises = estabs.map(codEstab =>
      this.getVendas(codEstab, dataInicio, dataFim)
        .then(result => ({
          codestab: codEstab,
          estabelecimento: this.estabelecimentosMap[codEstab],
          ...result
        }))
        .catch(() => ({
          codestab: codEstab,
          estabelecimento: this.estabelecimentosMap[codEstab],
          data: [],
          total: 0
        }))
    );

    const resultados = await Promise.all(vendasPromises);

    // Consolidar dados
    let faturamentoTotal = 0;
    let quantidadeVendas = 0;
    const procedimentosMap = {};
    const profissionaisMap = {};
    const faturamentoDiario = {};
    const faturamentoPorEstabelecimento = {};

    resultados.forEach(resultado => {
      const { codestab, estabelecimento, data } = resultado;

      if (!faturamentoPorEstabelecimento[codestab]) {
        faturamentoPorEstabelecimento[codestab] = {
          codestab,
          estabelecimento,
          valor: 0,
          quantidade: 0,
        };
      }

      if (Array.isArray(data)) {
        data.forEach(venda => {
          const valor = parseFloat(venda.valor_venda) || 0;
          faturamentoTotal += valor;
          quantidadeVendas++;
          faturamentoPorEstabelecimento[codestab].valor += valor;
          faturamentoPorEstabelecimento[codestab].quantidade++;

          // Agrupar por profissional (do nível da venda)
          const profNome = venda.nome_profissional || venda.profissional || venda.vendedor || null;
          if (profNome) {
            if (!profissionaisMap[profNome]) {
              profissionaisMap[profNome] = { nome: profNome, vendas: 0, valor: 0 };
            }
            profissionaisMap[profNome].vendas++;
            profissionaisMap[profNome].valor += valor;
          }

          // Agrupar por procedimento/item
          if (venda.itens_venda && Array.isArray(venda.itens_venda)) {
            venda.itens_venda.forEach(item => {
              const procNome = item.desc_item || 'Outros';
              const valorItem = parseFloat(item.valor_liquido) || 0;
              if (!procedimentosMap[procNome]) {
                procedimentosMap[procNome] = { nome: procNome, quantidade: 0, valor: 0 };
              }
              procedimentosMap[procNome].quantidade++;
              procedimentosMap[procNome].valor += valorItem;

              // Se o item tiver profissional, também contabiliza
              const itemProf = item.nome_profissional || item.profissional || null;
              if (itemProf && !profNome) {
                if (!profissionaisMap[itemProf]) {
                  profissionaisMap[itemProf] = { nome: itemProf, vendas: 0, valor: 0 };
                }
                profissionaisMap[itemProf].vendas++;
                profissionaisMap[itemProf].valor += valorItem;
              }
            });
          }

          // Agrupar por dia
          const dataVenda = venda.data_venda;
          if (dataVenda) {
            const dia = dataVenda.split(' ')[0];
            if (!faturamentoDiario[dia]) {
              faturamentoDiario[dia] = { data: dia, valor: 0 };
            }
            faturamentoDiario[dia].valor += valor;
          }
        });
      }
    });

    const ticketMedio = quantidadeVendas > 0 ? faturamentoTotal / quantidadeVendas : 0;

    return {
      faturamentoTotal,
      quantidadeVendas,
      ticketMedio,
      faturamentoDiario: Object.values(faturamentoDiario).sort((a, b) => a.data.localeCompare(b.data)),
      procedimentos: Object.values(procedimentosMap).sort((a, b) => b.valor - a.valor),
      profissionais: Object.values(profissionaisMap).sort((a, b) => b.valor - a.valor),
      porEstabelecimento: Object.values(faturamentoPorEstabelecimento),
    };
  }

  async getAnalyticsPacientes(dataInicio, dataFim, estabelecimentosFiltro = []) {
    const estabs = estabelecimentosFiltro.length > 0
      ? estabelecimentosFiltro
      : this.estabelecimentos;

    try {
      // Buscar vendas de todos os estabelecimentos
      const vendasPromises = estabs.map(codEstab =>
        this.getVendas(codEstab, dataInicio, dataFim)
          .catch(() => ({ data: [] }))
      );

      const resultados = await Promise.all(vendasPromises);

      // Consolidar vendas por cliente
      const vendasPorCliente = {};

      resultados.forEach(resultado => {
        const vendas = resultado.data || [];
        if (Array.isArray(vendas)) {
          vendas.forEach(venda => {
            const clienteId = venda.cod_cliente;
            const valor = parseFloat(venda.valor_venda) || 0;
            const dataVenda = venda.data_venda;

            if (!vendasPorCliente[clienteId]) {
              vendasPorCliente[clienteId] = {
                clienteId,
                cliente: `Cliente ${clienteId}`,
                investimento: 0,
                quantidadeVendas: 0,
                ultimaVenda: null,
              };
            }

            vendasPorCliente[clienteId].investimento += valor;
            vendasPorCliente[clienteId].quantidadeVendas++;

            if (dataVenda) {
              const dataAtual = new Date(dataVenda);
              const dataUltima = vendasPorCliente[clienteId].ultimaVenda
                ? new Date(vendasPorCliente[clienteId].ultimaVenda)
                : null;

              if (!dataUltima || dataAtual > dataUltima) {
                vendasPorCliente[clienteId].ultimaVenda = dataVenda;
              }
            }
          });
        }
      });

      // Calcular dias sem vir e categorizar
      const hoje = new Date();
      const faturamentoPorPaciente = [];
      const potenciaisMais4Meses = [];
      const potenciaisMenos4Meses = [];

      Object.values(vendasPorCliente).forEach(cliente => {
        faturamentoPorPaciente.push({
          cliente: cliente.cliente,
          clienteId: cliente.clienteId,
          investimento: cliente.investimento,
          quantidadeVendas: cliente.quantidadeVendas,
        });

        if (cliente.ultimaVenda) {
          const ultimaVenda = new Date(cliente.ultimaVenda);
          const diasSemVir = Math.floor((hoje - ultimaVenda) / (1000 * 60 * 60 * 24));

          const pacienteInfo = {
            cliente: cliente.cliente,
            clienteId: cliente.clienteId,
            diasSemVir,
            investimento: cliente.investimento,
          };

          if (diasSemVir > 120) {
            potenciaisMais4Meses.push(pacienteInfo);
          } else if (diasSemVir > 30) {
            potenciaisMenos4Meses.push(pacienteInfo);
          }
        }
      });

      return {
        totalClientes: Object.keys(vendasPorCliente).length,
        faturamentoPorPaciente: faturamentoPorPaciente
          .sort((a, b) => b.investimento - a.investimento)
          .slice(0, 100),
        potenciaisMais4Meses: potenciaisMais4Meses
          .sort((a, b) => b.diasSemVir - a.diasSemVir),
        potenciaisMenos4Meses: potenciaisMenos4Meses
          .sort((a, b) => b.diasSemVir - a.diasSemVir),
      };
    } catch (error) {
      logger.error('Erro ao buscar analytics de pacientes:', error.message);
      return {
        totalClientes: 0,
        faturamentoPorPaciente: [],
        potenciaisMais4Meses: [],
        potenciaisMenos4Meses: [],
      };
    }
  }

  async getCentrosCusto() {
    return {
      data: this.estabelecimentos.map(codestab => ({
        id: codestab.toString(),
        nome: this.estabelecimentosMap[codestab],
        codestab,
      })),
    };
  }

  // ==================== PROFISSIONAIS ====================

  async getProfissionais() {
    try {
      // Tenta buscar profissionais da API Belle
      const response = await this.client.get('/profissionais', {
        params: { codEstab: this.estabelecimentos[0] }
      });
      if (response.data && response.data.length > 0) {
        return { data: response.data };
      }
    } catch (error) {
      logger.debug('Endpoint /profissionais não disponível:', error.message);
    }

    // Fallback: extrair profissionais únicos das contas a receber (últimos 3 meses)
    try {
      const hoje = new Date();
      const tresMesesAtras = new Date();
      tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

      const dataInicio = format(tresMesesAtras, 'yyyy-MM-dd');
      const dataFim = format(hoje, 'yyyy-MM-dd');

      const profissionaisSet = new Set();

      // Buscar de todos estabelecimentos
      for (const codEstab of this.estabelecimentos) {
        const dados = await this.getContasReceber(codEstab, dataInicio, dataFim, 'lancamento');
        if (Array.isArray(dados)) {
          dados.forEach(movimento => {
            const prof = movimento.nome_profissional || movimento.profissional;
            if (prof && prof.trim()) {
              profissionaisSet.add(prof.trim());
            }
          });
        }
      }

      const profissionaisArray = Array.from(profissionaisSet).map((nome, idx) => ({
        id: idx + 1,
        nome,
      }));

      logger.info(`[Belle] Extraídos ${profissionaisArray.length} profissionais das contas a receber`);
      return { data: profissionaisArray };
    } catch (fallbackError) {
      logger.warn('Fallback de profissionais também falhou:', fallbackError.message);
      return { data: [] };
    }
  }

  // ==================== RELATÓRIOS ESPECIAIS ====================

  /**
   * Busca movimentação detalhada (serviços, produtos, etc)
   * Este endpoint tem o campo 'responsavel' que permite filtrar por profissional
   * @param {number} codEstab - Código do estabelecimento
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {Object} options - Opções de filtro
   * @param {boolean} options.incluirPlanos - Se deve incluir planos (default: true)
   */
  async getMovimentacaoDetalhado(codEstab, dataInicio, dataFim, options = {}) {
    const { incluirPlanos = true } = options;

    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/relatorios/movimentacao_detalhado', {
        codEstab,
        tipoPeriodo: 'Lançamento', // Com cedilha - valor correto da API
        dtInicio,
        dtFim,
        tipoMovimento: 'Entrada',
        situacao: 'Confirmado', // Parâmetro obrigatório
        // Filtros de origem - especifica quais tipos de movimentação incluir
        origemServico: 1, // Serviços
        origemPlano: incluirPlanos ? 1 : 0, // Planos (desativado para profissionais, pois já vem de venda_planos)
        origemProduto: 1, // Produtos
        origemCRE: 1, // Contas a receber
        origemOutrasVendas: 1, // Outras vendas
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar movimentacao detalhado (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Busca vendas de planos
   * Este endpoint tem o campo 'indicacao' que permite filtrar por profissional
   */
  async getVendaPlanos(codEstab, dataInicio, dataFim) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/venda_planos', {
        codEstab,
        tipoPeriodo: 'DataVenda',
        dtInicio,
        dtFim,
        statusPlano: 'Aprovado',
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar venda planos (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Converte valor do formato brasileiro (1.234,56) para número
   */
  parseBrazilianNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    // Remove pontos de milhar e substitui vírgula por ponto decimal
    const cleaned = String(value).replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Converte data do formato brasileiro (DD/MM/YYYY) para ISO (YYYY-MM-DD)
   */
  parseBrazilianDate(dateStr) {
    if (!dateStr) return null;
    // Se já está no formato ISO (YYYY-MM-DD), retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const match = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return null;
  }

  /**
   * Busca faturamento de Dermato filtrado por profissional
   * Usa dois endpoints: movimentacao_detalhado (responsavel) e venda_planos (indicacao)
   */
  async getFaturamentoDermatoPorProfissional(dataInicio, dataFim, profissionalFiltro) {
    const dermatoCodestab = config.metas.spa.dermatoCodestab; // 1

    // Divide o período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar dados de ambos endpoints em paralelo
    const movimentacaoPromises = [];
    const planosPromises = [];

    for (const chunk of chunks) {
      movimentacaoPromises.push(
        this.getMovimentacaoDetalhado(dermatoCodestab, chunk.inicio, chunk.fim)
          .catch(() => [])
      );
      planosPromises.push(
        this.getVendaPlanos(dermatoCodestab, chunk.inicio, chunk.fim)
          .catch(() => [])
      );
    }

    const [movimentacaoResults, planosResults] = await Promise.all([
      Promise.all(movimentacaoPromises),
      Promise.all(planosPromises),
    ]);

    let faturamentoTotal = 0;
    let faturamentoFiltrado = 0;

    // Debug: rastrear profissionais encontrados
    const profissionaisMovimentacao = {};
    const profissionaisPlanos = {};
    let sampleMovimentacaoLogged = false;
    let samplePlanoLogged = false;

    // Processar movimentação detalhada (filtrar por 'vendedor' dentro de detalhamento)
    // IMPORTANTE: Usa valor_bruto do movimento para evitar duplicação em parcelas
    // O valor_item no detalhamento mostra o valor TOTAL, não proporcional à parcela
    movimentacaoResults.flat().forEach(movimento => {
      // Debug: log sample uma vez
      if (!sampleMovimentacaoLogged && movimento) {
        logger.info(`[Belle] MOVIMENTACAO Sample Keys: ${Object.keys(movimento).join(', ')}`);
        if (Array.isArray(movimento.detalhamento) && movimento.detalhamento.length > 0) {
          logger.info(`[Belle] MOVIMENTACAO Detalhamento[0] Keys: ${Object.keys(movimento.detalhamento[0]).join(', ')}`);
          logger.info(`[Belle] MOVIMENTACAO Sample vendedor: "${movimento.detalhamento[0].vendedor}"`);
        }
        sampleMovimentacaoLogged = true;
      }

      // Usar valor_bruto do movimento (proporcional à parcela) ao invés de valor_item (total)
      const valorMovimento = this.parseBrazilianNumber(movimento.valor_bruto || 0);
      const detalhamentos = Array.isArray(movimento.detalhamento) ? movimento.detalhamento : [];

      // Se não há detalhamento, não podemos filtrar por vendedor
      if (detalhamentos.length === 0) {
        faturamentoTotal += valorMovimento;
        return;
      }

      // Calcular proporção de cada vendedor no movimento
      // (para casos onde um movimento tem múltiplos itens de vendedores diferentes)
      const totalItens = detalhamentos.reduce((sum, item) =>
        sum + this.parseBrazilianNumber(item.valor_item || 0), 0);

      detalhamentos.forEach(item => {
        const valorItem = this.parseBrazilianNumber(item.valor_item || 0);
        const vendedor = (item.vendedor || '').trim();

        // Calcular valor proporcional deste item no movimento
        // Se totalItens é 0, assume 100% para este item
        const proporcao = totalItens > 0 ? valorItem / totalItens : 1;
        const valorProporcional = valorMovimento * proporcao;

        faturamentoTotal += valorProporcional;

        // Debug: rastrear profissionais
        const profKey = vendedor || 'SEM_VENDEDOR';
        if (!profissionaisMovimentacao[profKey]) {
          profissionaisMovimentacao[profKey] = { count: 0, valor: 0 };
        }
        profissionaisMovimentacao[profKey].count++;
        profissionaisMovimentacao[profKey].valor += valorProporcional;

        // Filtrar por profissional
        if (vendedor.toUpperCase().includes(profissionalFiltro.toUpperCase())) {
          faturamentoFiltrado += valorProporcional;
        }
      });
    });

    // Processar vendas de planos (filtrar por 'indicacao')
    planosResults.flat().forEach(plano => {
      // precoFinal é o valor do plano já com desconto aplicado
      // Valores vêm no formato brasileiro (1.234,56)
      const valor = this.parseBrazilianNumber(plano.precoFinal || plano.preco || plano.valor);
      const indicacao = plano.indicacao || '';

      faturamentoTotal += valor;

      // Debug: log sample
      if (!samplePlanoLogged && plano) {
        logger.info(`[Belle] PLANO Sample Keys: ${Object.keys(plano).join(', ')}`);
        logger.info(`[Belle] PLANO Sample indicacao: "${indicacao}"`);
        samplePlanoLogged = true;
      }

      // Debug: rastrear profissionais
      const profKey = indicacao || 'SEM_INDICACAO';
      if (!profissionaisPlanos[profKey]) {
        profissionaisPlanos[profKey] = { count: 0, valor: 0 };
      }
      profissionaisPlanos[profKey].count++;
      profissionaisPlanos[profKey].valor += valor;

      // Filtrar por profissional
      if (indicacao.toUpperCase().includes(profissionalFiltro.toUpperCase())) {
        faturamentoFiltrado += valor;
      }
    });

    logger.info(`[Belle] DERMATO MOVIMENTACAO Profissionais: ${JSON.stringify(profissionaisMovimentacao, null, 2)}`);
    logger.info(`[Belle] DERMATO PLANOS Profissionais: ${JSON.stringify(profissionaisPlanos, null, 2)}`);
    logger.info(`[Belle] DERMATO Total: R$ ${faturamentoTotal.toFixed(2)}, Filtrado (${profissionalFiltro}): R$ ${faturamentoFiltrado.toFixed(2)}`);

    return {
      total: faturamentoTotal,
      filtrado: faturamentoFiltrado,
      profissional: profissionalFiltro,
    };
  }

  // ==================== METAS ====================

  /**
   * Calcula o faturamento por categoria de meta
   * - SPA: codestab 2 (SPA) + 11 (Estética) + 1 (Dermato apenas DRA KELLY DA CAS)
   * - Convênios: codestab 5
   * - Bela Laser: codestab 12
   * - Nutrologia: codestab 14
   *
   * IMPORTANTE: Para Dermato usamos endpoints especiais que têm info de profissional:
   * - /relatorios/movimentacao_detalhado (campo 'responsavel')
   * - /venda_planos (campo 'indicacao')
   */
  async getFaturamentoParaMetas(dataInicio, dataFim) {
    const metasConfig = config.metas;

    // Estabelecimentos que usam contas_receber (não precisam filtrar por profissional)
    const estabelecimentosContasReceber = new Set();
    metasConfig.spa.codestabs.forEach(c => estabelecimentosContasReceber.add(c)); // SPA (2) e Estética (11)
    metasConfig.convenios.codestabs.forEach(c => estabelecimentosContasReceber.add(c));
    metasConfig.belaLaser.codestabs.forEach(c => estabelecimentosContasReceber.add(c));
    metasConfig.nutrologia.codestabs.forEach(c => estabelecimentosContasReceber.add(c));

    const estabsContasReceber = Array.from(estabelecimentosContasReceber);

    // Divide o período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // 1. Buscar contas_receber para estabelecimentos que não precisam filtrar por profissional
    const contasReceberPromises = [];
    for (const codEstab of estabsContasReceber) {
      for (const chunk of chunks) {
        contasReceberPromises.push(
          this.getContasReceber(codEstab, chunk.inicio, chunk.fim, 'lancamento')
            .then(data => ({
              codestab: codEstab,
              data,
            }))
            .catch(() => ({
              codestab: codEstab,
              data: [],
            }))
        );
      }
    }

    // 2. Buscar faturamento de Dermato filtrado por profissional
    // Usa endpoints especiais: movimentacao_detalhado e venda_planos
    const dermatoPromise = this.getFaturamentoDermatoPorProfissional(
      dataInicio,
      dataFim,
      metasConfig.spa.dermatoProfissional
    );

    // Executar todas as requisições em paralelo
    const [contasReceberResults, dermatoResult] = await Promise.all([
      Promise.all(contasReceberPromises),
      dermatoPromise,
    ]);

    // Inicializar contadores por categoria
    const faturamentoPorCategoria = {
      spa: 0,
      convenios: 0,
      belaLaser: 0,
      nutrologia: 0,
    };

    // Processar resultados de contas_receber (SPA, Estética, Convênios, Bela Laser, Nutrologia)
    contasReceberResults.forEach(resultado => {
      const { codestab, data } = resultado;

      if (!Array.isArray(data)) return;

      data.forEach(movimento => {
        // Apenas movimentos confirmados
        if (movimento.confirmado !== 'S') return;

        const valor = parseFloat(movimento.valor_bruto) || 0;

        // SPA: codestabs 2 e 11
        if (metasConfig.spa.codestabs.includes(codestab)) {
          faturamentoPorCategoria.spa += valor;
        }
        // Convênios: codestab 5
        else if (metasConfig.convenios.codestabs.includes(codestab)) {
          faturamentoPorCategoria.convenios += valor;
        }
        // Bela Laser: codestab 12
        else if (metasConfig.belaLaser.codestabs.includes(codestab)) {
          faturamentoPorCategoria.belaLaser += valor;
        }
        // Nutrologia: codestab 14
        else if (metasConfig.nutrologia.codestabs.includes(codestab)) {
          faturamentoPorCategoria.nutrologia += valor;
        }
      });
    });

    // Adicionar faturamento de Dermato filtrado por profissional ao SPA
    faturamentoPorCategoria.spa += dermatoResult.filtrado;

    logger.info(`[Belle] Faturamento para metas calculado: SPA=${faturamentoPorCategoria.spa} (inclui Dermato Kelly: ${dermatoResult.filtrado}), Convênios=${faturamentoPorCategoria.convenios}, BelaLaser=${faturamentoPorCategoria.belaLaser}, Nutrologia=${faturamentoPorCategoria.nutrologia}`);

    return faturamentoPorCategoria;
  }

  /**
   * Busca procedimentos mais vendidos combinando:
   * - movimentacao_detalhado (sem plano - serviços, produtos, etc)
   * - venda_planos (planos aprovados)
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number} limit - Limite de resultados
   * @returns {Array} Lista de procedimentos com nome, quantidade e valor
   */
  async getProcedimentosFromAPIs(dataInicio, dataFim, limit = 20) {
    const procedimentosMap = {};

    // Divide período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar de todos os estabelecimentos
    const movimentacaoPromises = [];
    const planosPromises = [];

    for (const codEstab of this.estabelecimentos) {
      for (const chunk of chunks) {
        // Movimentação detalhada SEM planos (origemPlano: 0)
        movimentacaoPromises.push(
          this.getMovimentacaoDetalhado(codEstab, chunk.inicio, chunk.fim)
            .catch(err => {
              logger.warn(`[Belle] Erro movimentacao_detalhado estab ${codEstab}:`, err.message);
              return [];
            })
        );

        // Vendas de planos
        planosPromises.push(
          this.getVendaPlanos(codEstab, chunk.inicio, chunk.fim)
            .catch(err => {
              logger.warn(`[Belle] Erro venda_planos estab ${codEstab}:`, err.message);
              return [];
            })
        );
      }
    }

    const [movimentacaoResults, planosResults] = await Promise.all([
      Promise.all(movimentacaoPromises),
      Promise.all(planosPromises),
    ]);

    // Processar movimentação detalhada
    movimentacaoResults.flat().forEach(movimento => {
      const detalhamentos = Array.isArray(movimento.detalhamento) ? movimento.detalhamento : [];

      detalhamentos.forEach(item => {
        const procNome = (item.desc_item || '').trim();
        if (!procNome) return;

        const valorItem = this.parseBrazilianNumber(item.valor_item || 0);

        if (!procedimentosMap[procNome]) {
          procedimentosMap[procNome] = {
            nome: procNome,
            quantidade: 0,
            valor: 0,
          };
        }
        procedimentosMap[procNome].quantidade++;
        procedimentosMap[procNome].valor += valorItem;
      });
    });

    // Processar vendas de planos - extrair serviços do array servicos
    planosResults.flat().forEach(plano => {
      const servicos = Array.isArray(plano.servicos) ? plano.servicos : [];

      // Se não há serviços, ignora este plano
      if (servicos.length === 0) return;

      // Cada serviço dentro do plano é um procedimento
      servicos.forEach(servico => {
        const procNome = (servico.nomeServico || '').trim();
        if (!procNome) return;

        // valorTotalServico é o valor do serviço com desconto aplicado
        const valorServico = this.parseBrazilianNumber(servico.valorTotalServico || servico.valorServico || 0);
        const qtdSessoes = parseInt(servico.qtdSessoes) || 1;

        if (!procedimentosMap[procNome]) {
          procedimentosMap[procNome] = {
            nome: procNome,
            quantidade: 0,
            valor: 0,
          };
        }
        // Quantidade = número de sessões vendidas
        procedimentosMap[procNome].quantidade += qtdSessoes;
        procedimentosMap[procNome].valor += valorServico;
      });
    });

    // Termos a excluir (não são procedimentos reais)
    const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

    // Converter para array, filtrar termos excluídos, ordenar por valor e limitar
    const procedimentos = Object.values(procedimentosMap)
      .filter(p => {
        if (!p.nome || p.valor <= 0) return false;
        const nomeLower = p.nome.toLowerCase();
        return !excludeTerms.some(term => nomeLower.includes(term));
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limit);

    logger.info(`[Belle] getProcedimentosFromAPIs: ${procedimentos.length} procedimentos de ${Object.keys(procedimentosMap).length} encontrados`);

    return procedimentos;
  }

  /**
   * Busca procedimentos separados POR ESTABELECIMENTO
   * Retorna um array flat com cada procedimento incluindo cod_estab e nome_estab
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number} limitPerEstab - Limite de procedimentos por estabelecimento
   * @returns {Array} Lista de procedimentos com cod_estab, nome_estab, nome, quantidade, valor
   */
  async getProcedimentosByEstabelecimento(dataInicio, dataFim, limitPerEstab = 50) {
    // Map por estabelecimento: { codEstab: { procNome: { nome, quantidade, valor } } }
    const procedimentosPorEstab = {};

    // Divide período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Termos a excluir (não são procedimentos reais)
    const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

    // Para cada estabelecimento, buscar dados separadamente
    for (const codEstab of this.estabelecimentos) {
      procedimentosPorEstab[codEstab] = {};

      const movimentacaoPromises = [];
      const planosPromises = [];

      for (const chunk of chunks) {
        movimentacaoPromises.push(
          this.getMovimentacaoDetalhado(codEstab, chunk.inicio, chunk.fim)
            .catch(err => {
              logger.warn(`[Belle] Erro movimentacao_detalhado estab ${codEstab}:`, err.message);
              return [];
            })
        );

        planosPromises.push(
          this.getVendaPlanos(codEstab, chunk.inicio, chunk.fim)
            .catch(err => {
              logger.warn(`[Belle] Erro venda_planos estab ${codEstab}:`, err.message);
              return [];
            })
        );
      }

      const [movimentacaoResults, planosResults] = await Promise.all([
        Promise.all(movimentacaoPromises),
        Promise.all(planosPromises),
      ]);

      // Processar movimentação detalhada
      movimentacaoResults.flat().forEach(movimento => {
        const detalhamentos = Array.isArray(movimento.detalhamento) ? movimento.detalhamento : [];

        detalhamentos.forEach(item => {
          const procNome = (item.desc_item || '').trim();
          if (!procNome) return;

          const valorItem = this.parseBrazilianNumber(item.valor_item || 0);

          if (!procedimentosPorEstab[codEstab][procNome]) {
            procedimentosPorEstab[codEstab][procNome] = {
              nome: procNome,
              quantidade: 0,
              valor: 0,
            };
          }
          procedimentosPorEstab[codEstab][procNome].quantidade++;
          procedimentosPorEstab[codEstab][procNome].valor += valorItem;
        });
      });

      // Processar vendas de planos
      planosResults.flat().forEach(plano => {
        const servicos = Array.isArray(plano.servicos) ? plano.servicos : [];
        if (servicos.length === 0) return;

        servicos.forEach(servico => {
          const procNome = (servico.nomeServico || '').trim();
          if (!procNome) return;

          const valorServico = this.parseBrazilianNumber(servico.valorTotalServico || servico.valorServico || 0);
          const qtdSessoes = parseInt(servico.qtdSessoes) || 1;

          if (!procedimentosPorEstab[codEstab][procNome]) {
            procedimentosPorEstab[codEstab][procNome] = {
              nome: procNome,
              quantidade: 0,
              valor: 0,
            };
          }
          procedimentosPorEstab[codEstab][procNome].quantidade += qtdSessoes;
          procedimentosPorEstab[codEstab][procNome].valor += valorServico;
        });
      });
    }

    // Converter para array flat com cod_estab e nome_estab
    const resultado = [];

    for (const codEstab of this.estabelecimentos) {
      const nomeEstab = this.estabelecimentosMap[codEstab] || `Estab ${codEstab}`;
      const procs = Object.values(procedimentosPorEstab[codEstab])
        .filter(p => {
          if (!p.nome || p.valor <= 0) return false;
          const nomeLower = p.nome.toLowerCase();
          return !excludeTerms.some(term => nomeLower.includes(term));
        })
        .sort((a, b) => b.valor - a.valor)
        .slice(0, limitPerEstab);

      procs.forEach(proc => {
        resultado.push({
          cod_estab: codEstab,
          nome_estab: nomeEstab,
          nome: proc.nome,
          quantidade: proc.quantidade,
          valor: proc.valor,
        });
      });
    }

    logger.info(`[Belle] getProcedimentosByEstabelecimento: ${resultado.length} procedimentos de ${this.estabelecimentos.length} estabelecimentos`);

    return resultado;
  }

  /**
   * Busca profissionais com mais vendas combinando:
   * - movimentacao_detalhado (campo vendedor no detalhamento)
   * - venda_planos (campo indicacao)
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number} limit - Limite de resultados
   * @returns {Array} Lista de profissionais com nome, vendas e valor
   */
  async getProfissionaisFromAPIs(dataInicio, dataFim, limit = 20) {
    const profissionaisMap = {};

    // Divide período em chunks de 3 meses (limite da API)
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar de todos os estabelecimentos
    const movimentacaoPromises = [];
    const planosPromises = [];

    for (const codEstab of this.estabelecimentos) {
      for (const chunk of chunks) {
        // Para profissionais: NÃO incluir planos aqui (origemPlano: 0)
        // Planos já são capturados via venda_planos com campo 'indicacao'
        // Isso evita pegar vendedores comerciais no lugar de médicos/esteticistas
        movimentacaoPromises.push(
          this.getMovimentacaoDetalhado(codEstab, chunk.inicio, chunk.fim, { incluirPlanos: false })
            .catch(err => {
              logger.warn(`[Belle] Erro movimentacao_detalhado estab ${codEstab}:`, err.message);
              return [];
            })
        );

        planosPromises.push(
          this.getVendaPlanos(codEstab, chunk.inicio, chunk.fim)
            .catch(err => {
              logger.warn(`[Belle] Erro venda_planos estab ${codEstab}:`, err.message);
              return [];
            })
        );
      }
    }

    const [movimentacaoResults, planosResults] = await Promise.all([
      Promise.all(movimentacaoPromises),
      Promise.all(planosPromises),
    ]);

    // Processar movimentação detalhada - usa campo 'vendedor' no detalhamento
    movimentacaoResults.flat().forEach(movimento => {
      const valorMovimento = this.parseBrazilianNumber(movimento.valor_bruto || 0);
      const detalhamentos = Array.isArray(movimento.detalhamento) ? movimento.detalhamento : [];

      if (detalhamentos.length === 0) return;

      // Calcular proporção de cada vendedor
      const totalItens = detalhamentos.reduce((sum, item) =>
        sum + this.parseBrazilianNumber(item.valor_item || 0), 0);

      detalhamentos.forEach(item => {
        const vendedor = (item.vendedor || '').trim();
        if (!vendedor) return;

        const valorItem = this.parseBrazilianNumber(item.valor_item || 0);
        const proporcao = totalItens > 0 ? valorItem / totalItens : 1;
        const valorProporcional = valorMovimento * proporcao;

        if (!profissionaisMap[vendedor]) {
          profissionaisMap[vendedor] = {
            nome: vendedor,
            vendas: 0,
            valor: 0,
          };
        }
        profissionaisMap[vendedor].vendas++;
        profissionaisMap[vendedor].valor += valorProporcional;
      });
    });

    // Processar vendas de planos - usa campo 'indicacao'
    planosResults.flat().forEach(plano => {
      const indicacao = (plano.indicacao || '').trim();
      if (!indicacao) return;

      const valor = this.parseBrazilianNumber(plano.precoFinal || plano.preco || plano.valor || 0);

      if (!profissionaisMap[indicacao]) {
        profissionaisMap[indicacao] = {
          nome: indicacao,
          vendas: 0,
          valor: 0,
        };
      }
      profissionaisMap[indicacao].vendas++;
      profissionaisMap[indicacao].valor += valor;
    });

    // Converter para array, ordenar por valor e limitar
    const profissionais = Object.values(profissionaisMap)
      .filter(p => p.nome && p.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limit);

    logger.info(`[Belle] getProfissionaisFromAPIs: ${profissionais.length} profissionais de ${Object.keys(profissionaisMap).length} encontrados`);

    return profissionais;
  }

  /**
   * Busca procedimentos DIÁRIOS por estabelecimento para sync
   * Retorna array com data_ref, cod_estab, nome_proc, quantidade, valor
   * Combina movimentacao_detalhado (com dt_lancamento) e venda_planos (com dtVenda)
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Array} Lista de procedimentos com data_ref, cod_estab, nome_estab, nome_proc, quantidade, valor
   */
  async getProcedimentosDiariosPorEstab(dataInicio, dataFim) {
    // Map: `${data}_${codEstab}_${procNome}` -> { data_ref, cod_estab, nome_estab, nome_proc, quantidade, valor }
    const procedimentosMap = {};

    // Termos a excluir (não são procedimentos reais)
    const excludeTerms = ['plano personalizado', 'voucher', 'produtos', 'credito', 'cortesia'];

    // Para cada estabelecimento
    for (const codEstab of this.estabelecimentos) {
      const nomeEstab = this.estabelecimentosMap[codEstab] || `Estab ${codEstab}`;

      // Buscar movimentação detalhada e planos
      const [movimentacaoData, planosData] = await Promise.all([
        this.getMovimentacaoDetalhado(codEstab, dataInicio, dataFim).catch(err => {
          logger.warn(`[Belle] getProcedimentosDiarios - erro movimentacao estab ${codEstab}:`, err.message);
          return [];
        }),
        this.getVendaPlanos(codEstab, dataInicio, dataFim).catch(err => {
          logger.warn(`[Belle] getProcedimentosDiarios - erro planos estab ${codEstab}:`, err.message);
          return [];
        }),
      ]);

      // Processar movimentação detalhada
      movimentacaoData.forEach(movimento => {
        // A API retorna data_lancamento no formato ISO (YYYY-MM-DD)
        const dataRef = movimento.data_lancamento || this.parseBrazilianDate(movimento.dt_lancamento);
        if (!dataRef) return;

        const detalhamentos = Array.isArray(movimento.detalhamento) ? movimento.detalhamento : [];

        detalhamentos.forEach(item => {
          // A API retorna 'descricao' no formato "408675870-Plano Personalizado" - extrair nome após o hífen
          const rawDesc = item.descricao || item.desc_item || '';
          // Remove o prefixo numérico se existir (ex: "408675870-Plano Personalizado" -> "Plano Personalizado")
          const procNome = rawDesc.includes('-') ? rawDesc.split('-').slice(1).join('-').trim() : rawDesc.trim();
          if (!procNome) return;

          // Filtrar termos excluídos
          const nomeLower = procNome.toLowerCase();
          if (excludeTerms.some(term => nomeLower.includes(term))) return;

          const valorItem = this.parseBrazilianNumber(item.valor_item || 0);
          const key = `${dataRef}_${codEstab}_${procNome}`;

          if (!procedimentosMap[key]) {
            procedimentosMap[key] = {
              data_ref: dataRef,
              cod_estab: codEstab,
              nome_estab: nomeEstab,
              nome_proc: procNome,
              quantidade: 0,
              valor: 0,
            };
          }
          procedimentosMap[key].quantidade++;
          procedimentosMap[key].valor += valorItem;
        });
      });

      // Processar vendas de planos - extrai serviços individuais
      planosData.forEach(plano => {
        const dataRef = this.parseBrazilianDate(plano.dtVenda || plano.dataVenda);
        if (!dataRef) return;

        const servicos = Array.isArray(plano.servicos) ? plano.servicos : [];
        if (servicos.length === 0) return;

        servicos.forEach(servico => {
          const procNome = (servico.nomeServico || '').trim();
          if (!procNome) return;

          // Filtrar termos excluídos
          const nomeLower = procNome.toLowerCase();
          if (excludeTerms.some(term => nomeLower.includes(term))) return;

          const valorServico = this.parseBrazilianNumber(servico.valorTotalServico || servico.valorServico || 0);
          const qtdSessoes = parseInt(servico.qtdSessoes) || 1;

          const key = `${dataRef}_${codEstab}_${procNome}`;

          if (!procedimentosMap[key]) {
            procedimentosMap[key] = {
              data_ref: dataRef,
              cod_estab: codEstab,
              nome_estab: nomeEstab,
              nome_proc: procNome,
              quantidade: 0,
              valor: 0,
            };
          }
          procedimentosMap[key].quantidade += qtdSessoes;
          procedimentosMap[key].valor += valorServico;
        });
      });
    }

    const resultado = Object.values(procedimentosMap).filter(p => p.valor > 0 || p.quantidade > 0);

    logger.info(`[Belle] getProcedimentosDiariosPorEstab: ${resultado.length} registros de ${dataInicio} a ${dataFim}`);

    return resultado;
  }

  async getMetasByPeriodo(dataInicio, dataFim) {
    try {
      // A API Belle pode não ter endpoint de metas, então retornamos estrutura padrão
      // As metas podem ser configuradas manualmente ou em outro sistema
      const metas = {
        spa: { meta: 1060000, atual: 0 },
        convenios: { meta: 210000, atual: 0 },
        belaLaser: { meta: 100000, atual: 0 },
        nutrologia: { meta: 50000, atual: 0 },
        dermato: { meta: 200000, atual: 0 },
        estetica: { meta: 150000, atual: 0 },
        drips: { meta: 80000, atual: 0 },
      };

      // Buscar faturamento atual para calcular progresso
      const faturamento = await this.getAnalyticsFaturamento(dataInicio, dataFim, []);

      // Distribuir faturamento por estabelecimento
      if (faturamento.porEstabelecimento) {
        faturamento.porEstabelecimento.forEach(estab => {
          const nomeEstab = estab.estabelecimento?.toLowerCase();
          if (nomeEstab?.includes('spa')) metas.spa.atual += estab.valor;
          else if (nomeEstab?.includes('conv')) metas.convenios.atual += estab.valor;
          else if (nomeEstab?.includes('bela') || nomeEstab?.includes('laser')) metas.belaLaser.atual += estab.valor;
          else if (nomeEstab?.includes('nutro')) metas.nutrologia.atual += estab.valor;
          else if (nomeEstab?.includes('dermato')) metas.dermato.atual += estab.valor;
          else if (nomeEstab?.includes('estet')) metas.estetica.atual += estab.valor;
          else if (nomeEstab?.includes('drip')) metas.drips.atual += estab.valor;
        });
      }

      return {
        data: Object.entries(metas).map(([key, value]) => ({
          nome: key,
          ...value,
          percentual: value.meta > 0 ? ((value.atual / value.meta) * 100).toFixed(2) : 0
        }))
      };
    } catch (error) {
      logger.error('Erro ao buscar metas:', error.message);
      return { data: [] };
    }
  }

  async getDashboardResumo(dataInicio, dataFim, estabelecimentosFiltro = []) {
    return this.getAnalyticsFaturamento(dataInicio, dataFim, estabelecimentosFiltro);
  }

  // ==================== CUSTOMER LIFETIME VALUE & RETENTION ====================

  /**
   * Calcula métricas de Customer Lifetime Value (LTV) e retenção
   * Baseado no histórico de vendas por cliente
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number[]} estabelecimentosFiltro - Filtro de estabelecimentos
   * @returns {Object} Métricas de LTV e retenção
   */
  async getCustomerLTVMetrics(dataInicio, dataFim, estabelecimentosFiltro = []) {
    const estabs = estabelecimentosFiltro.length > 0
      ? estabelecimentosFiltro
      : this.estabelecimentos;

    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar todas as vendas do período
    const allPromises = [];
    for (const codEstab of estabs) {
      for (const chunk of chunks) {
        allPromises.push(
          this.getVendas(codEstab, chunk.inicio, chunk.fim)
            .then(result => result.data || [])
            .catch(() => [])
        );
      }
    }

    const vendasArrays = await Promise.all(allPromises);
    const todasVendas = vendasArrays.flat();

    // Agrupar vendas por cliente
    const clientesMap = {};

    todasVendas.forEach(venda => {
      const clienteId = venda.cod_cliente;
      if (!clienteId) return;

      const valor = parseFloat(venda.valor_venda) || 0;
      const dataVenda = venda.data_venda;

      if (!clientesMap[clienteId]) {
        clientesMap[clienteId] = {
          id: clienteId,
          totalGasto: 0,
          numCompras: 0,
          primeiraCompra: dataVenda,
          ultimaCompra: dataVenda,
          compras: [],
        };
      }

      clientesMap[clienteId].totalGasto += valor;
      clientesMap[clienteId].numCompras++;
      clientesMap[clienteId].compras.push({ data: dataVenda, valor });

      // Atualizar datas de primeira e última compra
      if (dataVenda && (!clientesMap[clienteId].primeiraCompra || dataVenda < clientesMap[clienteId].primeiraCompra)) {
        clientesMap[clienteId].primeiraCompra = dataVenda;
      }
      if (dataVenda && (!clientesMap[clienteId].ultimaCompra || dataVenda > clientesMap[clienteId].ultimaCompra)) {
        clientesMap[clienteId].ultimaCompra = dataVenda;
      }
    });

    const clientes = Object.values(clientesMap);

    if (clientes.length === 0) {
      return {
        totalClientes: 0,
        avgLTV: 0,
        avgPurchases: 0,
        avgTicket: 0,
        retentionRate: 0,
        churnRate: 0,
        newCustomers: 0,
        returningCustomers: 0,
        topCustomers: [],
        ltvDistribution: [],
      };
    }

    // Calcular métricas
    const totalGastoGeral = clientes.reduce((sum, c) => sum + c.totalGasto, 0);
    const totalCompras = clientes.reduce((sum, c) => sum + c.numCompras, 0);

    const avgLTV = totalGastoGeral / clientes.length;
    const avgPurchases = totalCompras / clientes.length;
    const avgTicket = totalCompras > 0 ? totalGastoGeral / totalCompras : 0;

    // Clientes novos vs recorrentes (com mais de 1 compra no período)
    const newCustomers = clientes.filter(c => c.numCompras === 1).length;
    const returningCustomers = clientes.filter(c => c.numCompras > 1).length;

    // Taxa de retenção (clientes com mais de 1 compra / total)
    const retentionRate = clientes.length > 0
      ? (returningCustomers / clientes.length) * 100
      : 0;
    const churnRate = 100 - retentionRate;

    // Top 10 clientes por LTV
    const topCustomers = clientes
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        totalGasto: c.totalGasto,
        numCompras: c.numCompras,
        ticketMedio: c.numCompras > 0 ? c.totalGasto / c.numCompras : 0,
      }));

    // Distribuição de LTV (buckets)
    const ltvBuckets = [
      { label: 'R$ 0-500', min: 0, max: 500, count: 0 },
      { label: 'R$ 500-1k', min: 500, max: 1000, count: 0 },
      { label: 'R$ 1k-2.5k', min: 1000, max: 2500, count: 0 },
      { label: 'R$ 2.5k-5k', min: 2500, max: 5000, count: 0 },
      { label: 'R$ 5k-10k', min: 5000, max: 10000, count: 0 },
      { label: 'R$ 10k+', min: 10000, max: Infinity, count: 0 },
    ];

    clientes.forEach(c => {
      const bucket = ltvBuckets.find(b => c.totalGasto >= b.min && c.totalGasto < b.max);
      if (bucket) bucket.count++;
    });

    const ltvDistribution = ltvBuckets.map(b => ({
      label: b.label,
      count: b.count,
      percentage: clientes.length > 0 ? ((b.count / clientes.length) * 100).toFixed(1) : 0,
    }));

    logger.info(`[Belle] getCustomerLTVMetrics: ${clientes.length} clientes, avgLTV=R$ ${avgLTV.toFixed(2)}, retention=${retentionRate.toFixed(1)}%`);

    return {
      totalClientes: clientes.length,
      avgLTV: Math.round(avgLTV * 100) / 100,
      avgPurchases: Math.round(avgPurchases * 10) / 10,
      avgTicket: Math.round(avgTicket * 100) / 100,
      retentionRate: Math.round(retentionRate * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      newCustomers,
      returningCustomers,
      topCustomers,
      ltvDistribution,
    };
  }

  /**
   * Busca dados de vouchers do período
   * Vouchers são vendas com desc_item contendo "voucher" ou "cartão presente"
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Object} Métricas de vouchers
   */
  async getVoucherAnalytics(dataInicio, dataFim) {
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar movimentação de todos os estabelecimentos
    const promises = [];
    for (const codEstab of this.estabelecimentos) {
      for (const chunk of chunks) {
        promises.push(
          this.getMovimentacaoDetalhado(codEstab, chunk.inicio, chunk.fim)
            .catch(() => [])
        );
      }
    }

    const results = await Promise.all(promises);
    const todasMovimentacoes = results.flat();

    // Filtrar vouchers e cartões presente
    const voucherTerms = ['voucher', 'cartão presente', 'cartao presente', 'gift card', 'vale presente'];
    let totalVendido = 0;
    let quantidadeVendida = 0;
    const vouchersPorMes = {};

    todasMovimentacoes.forEach(mov => {
      const detalhamentos = Array.isArray(mov.detalhamento) ? mov.detalhamento : [];

      detalhamentos.forEach(item => {
        const descricao = (item.desc_item || item.descricao || '').toLowerCase();
        const isVoucher = voucherTerms.some(term => descricao.includes(term));

        if (isVoucher) {
          const valor = this.parseBrazilianNumber(item.valor_item || 0);
          totalVendido += valor;
          quantidadeVendida++;

          // Agrupar por mês
          const dataLancamento = mov.data_lancamento || this.parseBrazilianDate(mov.dt_lancamento);
          if (dataLancamento) {
            const mes = dataLancamento.substring(0, 7); // yyyy-MM
            if (!vouchersPorMes[mes]) {
              vouchersPorMes[mes] = { mes, quantidade: 0, valor: 0 };
            }
            vouchersPorMes[mes].quantidade++;
            vouchersPorMes[mes].valor += valor;
          }
        }
      });
    });

    const ticketMedio = quantidadeVendida > 0 ? totalVendido / quantidadeVendida : 0;

    logger.info(`[Belle] getVoucherAnalytics: ${quantidadeVendida} vouchers vendidos, total=R$ ${totalVendido.toFixed(2)}`);

    return {
      totalVendido,
      quantidadeVendida,
      ticketMedio,
      vouchersPorMes: Object.values(vouchersPorMes).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  }

  /**
   * Calcula taxa de recorrência de pacientes
   * Identifica pacientes que retornam após um intervalo mínimo de dias
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number} minIntervalDays - Intervalo mínimo para considerar recorrência (default: 30)
   * @returns {Object} Métricas de recorrência
   */
  async getRecurrenceMetrics(dataInicio, dataFim, minIntervalDays = 30) {
    const estabs = this.estabelecimentos;
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    // Buscar todas as vendas
    const allPromises = [];
    for (const codEstab of estabs) {
      for (const chunk of chunks) {
        allPromises.push(
          this.getVendas(codEstab, chunk.inicio, chunk.fim)
            .then(result => result.data || [])
            .catch(() => [])
        );
      }
    }

    const vendasArrays = await Promise.all(allPromises);
    const todasVendas = vendasArrays.flat();

    // Agrupar por cliente e ordenar por data
    const clientesMap = {};

    todasVendas.forEach(venda => {
      const clienteId = venda.cod_cliente;
      if (!clienteId || !venda.data_venda) return;

      if (!clientesMap[clienteId]) {
        clientesMap[clienteId] = [];
      }
      clientesMap[clienteId].push(new Date(venda.data_venda));
    });

    // Calcular recorrência
    let clientesRecorrentes = 0;
    let totalIntervalosDias = 0;
    let numIntervalos = 0;

    Object.values(clientesMap).forEach(datas => {
      if (datas.length < 2) return;

      // Ordenar datas
      datas.sort((a, b) => a - b);

      // Verificar intervalos entre visitas
      let temRecorrencia = false;
      for (let i = 1; i < datas.length; i++) {
        const intervalo = (datas[i] - datas[i - 1]) / (1000 * 60 * 60 * 24); // dias
        if (intervalo >= minIntervalDays) {
          temRecorrencia = true;
          totalIntervalosDias += intervalo;
          numIntervalos++;
        }
      }

      if (temRecorrencia) {
        clientesRecorrentes++;
      }
    });

    const totalClientes = Object.keys(clientesMap).length;
    const taxaRecorrencia = totalClientes > 0
      ? (clientesRecorrentes / totalClientes) * 100
      : 0;
    const intervaloMedio = numIntervalos > 0
      ? totalIntervalosDias / numIntervalos
      : 0;

    logger.info(`[Belle] getRecurrenceMetrics: ${clientesRecorrentes} de ${totalClientes} clientes recorrentes (${taxaRecorrencia.toFixed(1)}%)`);

    return {
      totalClientes,
      clientesRecorrentes,
      taxaRecorrencia: Math.round(taxaRecorrencia * 10) / 10,
      intervaloMedioDias: Math.round(intervaloMedio),
      minIntervalDays,
    };
  }

  // ==================== RELATÓRIOS DE ATIVIDADE DE CLIENTES ====================

  /**
   * Busca atividade de clientes ativos
   * Endpoint: /relatorios/atividade_clientes
   *
   * @param {number} codEstab - Código do estabelecimento
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Array} Lista de clientes ativos com atividade
   */
  async getAtividadeClientesAtivos(codEstab, dataInicio, dataFim) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/relatorios/atividade_clientes', {
        codEstab,
        dtInicio,
        dtFim,
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar atividade clientes ativos (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Busca atividade de clientes inativos
   * Endpoint: /relatorios/atividade_clientes_inativos
   *
   * @param {number} codEstab - Código do estabelecimento
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Array} Lista de clientes inativos
   */
  async getAtividadeClientesInativos(codEstab, dataInicio, dataFim) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/relatorios/atividade_clientes_inativos', {
        codEstab,
        dtInicio,
        dtFim,
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar atividade clientes inativos (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Busca resumo comercial de clientes
   * Endpoint: /relatorios/resumo_comercial_clientes
   *
   * @param {number} codEstab - Código do estabelecimento
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Array} Resumo comercial com LTV, ticket médio, etc.
   */
  async getResumoComercialClientes(codEstab, dataInicio, dataFim) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/relatorios/resumo_comercial_clientes', {
        codEstab,
        dtVendaIni: dtInicio,
        dtVendaFim: dtFim,
      });
      return data || [];
    } catch (error) {
      logger.error(`Erro ao buscar resumo comercial clientes (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Busca dados consolidados de atividade de clientes de TODOS os estabelecimentos
   * Combina clientes ativos e inativos para análise completa
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Object} Dados consolidados de atividade
   */
  async getAtividadeClientesConsolidado(dataInicio, dataFim) {
    const chunks = this.dividePeriodoEmChunks(dataInicio, dataFim);

    const ativosPromises = [];
    const inativosPromises = [];
    const resumoPromises = [];

    for (const codEstab of this.estabelecimentos) {
      for (const chunk of chunks) {
        ativosPromises.push(
          this.getAtividadeClientesAtivos(codEstab, chunk.inicio, chunk.fim)
            .then(data => ({ codEstab, data }))
            .catch(() => ({ codEstab, data: [] }))
        );
        inativosPromises.push(
          this.getAtividadeClientesInativos(codEstab, chunk.inicio, chunk.fim)
            .then(data => ({ codEstab, data }))
            .catch(() => ({ codEstab, data: [] }))
        );
        resumoPromises.push(
          this.getResumoComercialClientes(codEstab, chunk.inicio, chunk.fim)
            .then(data => ({ codEstab, data }))
            .catch(() => ({ codEstab, data: [] }))
        );
      }
    }

    const [ativosResults, inativosResults, resumoResults] = await Promise.all([
      Promise.all(ativosPromises),
      Promise.all(inativosPromises),
      Promise.all(resumoPromises),
    ]);

    // Consolidar dados
    const clientesAtivosMap = {};
    const clientesInativosMap = {};
    let totalAtivos = 0;
    let totalInativos = 0;

    // Processar clientes ativos
    ativosResults.forEach(result => {
      if (Array.isArray(result.data)) {
        result.data.forEach(cliente => {
          const id = cliente.codCliente || cliente.cod_cliente;
          if (id && !clientesAtivosMap[id]) {
            clientesAtivosMap[id] = {
              id,
              nome: cliente.nomeCliente || cliente.nome_cliente || `Cliente ${id}`,
              ultimaVisita: cliente.dtUltimaVisita || cliente.dt_ultima_visita,
              totalVisitas: parseInt(cliente.qtdVisitas || cliente.qtd_visitas) || 0,
              totalGasto: this.parseBrazilianNumber(cliente.valorTotal || cliente.valor_total || 0),
              estabelecimento: this.estabelecimentosMap[result.codEstab],
            };
            totalAtivos++;
          }
        });
      }
    });

    // Processar clientes inativos
    inativosResults.forEach(result => {
      if (Array.isArray(result.data)) {
        result.data.forEach(cliente => {
          const id = cliente.codCliente || cliente.cod_cliente;
          if (id && !clientesInativosMap[id]) {
            clientesInativosMap[id] = {
              id,
              nome: cliente.nomeCliente || cliente.nome_cliente || `Cliente ${id}`,
              ultimaVisita: cliente.dtUltimaVisita || cliente.dt_ultima_visita,
              diasInativo: parseInt(cliente.diasInativo || cliente.dias_inativo) || 0,
              totalGasto: this.parseBrazilianNumber(cliente.valorTotal || cliente.valor_total || 0),
              estabelecimento: this.estabelecimentosMap[result.codEstab],
            };
            totalInativos++;
          }
        });
      }
    });

    // Calcular métricas
    const clientesAtivos = Object.values(clientesAtivosMap);
    const clientesInativos = Object.values(clientesInativosMap);

    const taxaAtividade = totalAtivos + totalInativos > 0
      ? (totalAtivos / (totalAtivos + totalInativos)) * 100
      : 0;

    const ticketMedioAtivos = clientesAtivos.length > 0
      ? clientesAtivos.reduce((sum, c) => sum + c.totalGasto, 0) / clientesAtivos.length
      : 0;

    logger.info(`[Belle] getAtividadeClientesConsolidado: ${totalAtivos} ativos, ${totalInativos} inativos`);

    return {
      totalAtivos,
      totalInativos,
      taxaAtividade: Math.round(taxaAtividade * 10) / 10,
      ticketMedioAtivos: Math.round(ticketMedioAtivos * 100) / 100,
      clientesAtivos: clientesAtivos.slice(0, 100),
      clientesInativos: clientesInativos.sort((a, b) => b.diasInativo - a.diasInativo).slice(0, 100),
      periodo: { inicio: dataInicio, fim: dataFim },
    };
  }

  /**
   * Busca top 10 clientes por faturamento
   * Endpoint: /relatorios/dez_principais_clientes (se disponível)
   *
   * @param {number} codEstab - Código do estabelecimento
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @returns {Array} Top 10 clientes
   */
  async getTopClientes(codEstab, dataInicio, dataFim) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const data = await this.cachedRequest('/relatorios/dez_principais_clientes', {
        codEstab,
        dtInicio,
        dtFim,
      });
      return data || [];
    } catch (error) {
      logger.warn(`Endpoint dez_principais_clientes não disponível (estab ${codEstab}):`, error.message);
      return [];
    }
  }

  /**
   * Calcula métricas avançadas de pacientes para o BI
   * Combina dados de atividade, LTV e segmentação
   *
   * @param {string} dataInicio - Data início (yyyy-MM-dd)
   * @param {string} dataFim - Data fim (yyyy-MM-dd)
   * @param {number[]} estabelecimentosFiltro - Filtro de estabelecimentos
   * @returns {Object} Métricas avançadas de pacientes
   */
  async getMetricasAvancadasPacientes(dataInicio, dataFim, estabelecimentosFiltro = []) {
    const estabs = estabelecimentosFiltro.length > 0
      ? estabelecimentosFiltro
      : this.estabelecimentos;

    try {
      // Buscar dados em paralelo
      const [atividadeData, ltvData, recorrenciaData] = await Promise.all([
        this.getAtividadeClientesConsolidado(dataInicio, dataFim),
        this.getCustomerLTVMetrics(dataInicio, dataFim, estabs),
        this.getRecurrenceMetrics(dataInicio, dataFim, 30),
      ]);

      // Calcular segmentação por valor (Good-fit vs Bad-fit para 8Ps)
      const avgLtv = ltvData.avgLTV || 0;
      const avgTicket = ltvData.avgTicket || 0;

      // Good-fit: clientes com LTV acima da média e mais de 1 compra
      const goodFitClientes = ltvData.topCustomers?.filter(c =>
        c.totalGasto > avgLtv && c.numCompras > 1
      ) || [];

      // Calcular taxa de churn (clientes inativos / total)
      const totalClientes = atividadeData.totalAtivos + atividadeData.totalInativos;
      const taxaChurn = totalClientes > 0
        ? (atividadeData.totalInativos / totalClientes) * 100
        : 0;

      // MAC (Monthly Active Customers) - usar ativos do período
      const mac = atividadeData.totalAtivos;

      return {
        // Métricas de Atividade
        totalAtivos: atividadeData.totalAtivos,
        totalInativos: atividadeData.totalInativos,
        taxaAtividade: atividadeData.taxaAtividade,
        taxaChurn: Math.round(taxaChurn * 10) / 10,
        mac,

        // Métricas de Valor
        avgLTV: ltvData.avgLTV,
        avgTicket: ltvData.avgTicket,
        avgPurchases: ltvData.avgPurchases,

        // Métricas de Recorrência
        taxaRecorrencia: recorrenciaData.taxaRecorrencia,
        intervaloMedioDias: recorrenciaData.intervaloMedioDias,
        clientesRecorrentes: recorrenciaData.clientesRecorrentes,

        // Segmentação Good-fit / Bad-fit (8Ps)
        goodFitCount: goodFitClientes.length,
        goodFitPercentual: totalClientes > 0
          ? Math.round((goodFitClientes.length / totalClientes) * 1000) / 10
          : 0,
        topGoodFitClientes: goodFitClientes.slice(0, 10),

        // Distribuição LTV
        ltvDistribution: ltvData.ltvDistribution,

        // Listas para detalhamento
        clientesInativos: atividadeData.clientesInativos,
        periodo: { inicio: dataInicio, fim: dataFim },
      };
    } catch (error) {
      logger.error('Erro ao calcular métricas avançadas de pacientes:', error.message);
      return {
        totalAtivos: 0,
        totalInativos: 0,
        taxaAtividade: 0,
        taxaChurn: 0,
        mac: 0,
        avgLTV: 0,
        avgTicket: 0,
        avgPurchases: 0,
        taxaRecorrencia: 0,
        intervaloMedioDias: 0,
        clientesRecorrentes: 0,
        goodFitCount: 0,
        goodFitPercentual: 0,
        topGoodFitClientes: [],
        ltvDistribution: [],
        clientesInativos: [],
        periodo: { inicio: dataInicio, fim: dataFim },
      };
    }
  }
}

export default new BelleService();
