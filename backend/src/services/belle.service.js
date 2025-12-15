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
   */
  async getMovimentacaoDetalhado(codEstab, dataInicio, dataFim) {
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
        origemPlano: 0, // Planos (0 pois temos endpoint separado)
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
}

export default new BelleService();
