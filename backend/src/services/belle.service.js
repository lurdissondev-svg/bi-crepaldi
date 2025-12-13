import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { format, parse } from 'date-fns';

class BelleService {
  constructor() {
    this.baseUrl = config.belle.apiUrl;
    this.token = config.belle.token;
    this.estabelecimentos = config.belle.estabelecimentos;
    this.estabelecimentosMap = config.belle.estabelecimentosMap;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minutes para endpoints com muitos dados
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

  // Formata data para o padrão Belle (dd/mm/yyyy)
  formatDateBelle(dateStr) {
    if (!dateStr) return '';
    try {
      // Se já estiver no formato dd/mm/yyyy, retorna
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

      // Se estiver em ISO ou outro formato, converte
      const date = new Date(dateStr);
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

      const response = await this.client.get('/vendas', {
        params: {
          estab: codEstab,
          dtInicio,
          dtFim,
          ...params,
        },
      });
      return { data: response.data || [], total: response.data?.length || 0 };
    } catch (error) {
      logger.error(`Erro ao buscar vendas (estab ${codEstab}):`, error.message);
      return { data: [], total: 0 };
    }
  }

  async getVendasDetalhado(codEstab, dataInicio, dataFim, params = {}) {
    try {
      const dtInicio = this.formatDateBelle(dataInicio);
      const dtFim = this.formatDateBelle(dataFim);

      const response = await this.client.get('/vendas/detalhado', {
        params: {
          estab: codEstab,
          dtInicio,
          dtFim,
          ...params,
        },
      });
      return { data: response.data || [], total: response.data?.length || 0 };
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

      const response = await this.client.get('/contas_receber', {
        params: {
          estab: codEstab,
          dtInicio,
          dtFim,
          tipoData,
        },
      });
      return response.data || [];
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

      const response = await this.client.get('/contas_receber', {
        params: {
          dtInicio,
          dtFim,
          tipoData,
        },
      });
      return response.data || [];
    } catch (error) {
      logger.error(`Erro ao buscar todas as contas a receber:`, error.message);
      return [];
    }
  }

  // Calcula faturamento de TODAS as contas a receber (sem filtro de estab)
  async getFaturamentoHoje(dataInicio, dataFim) {
    try {
      const dados = await this.getContasReceberTodos(dataInicio, dataFim, 'lancamento');

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
      };
    } catch (error) {
      logger.error('Erro ao calcular faturamento de hoje:', error.message);
      return { faturamentoTotal: 0, quantidadeMovimentos: 0 };
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
      return { data: response.data || [] };
    } catch (error) {
      logger.debug('Endpoint /profissionais não disponível, usando dados locais');
      // Retorna lista vazia como fallback (profissionais seriam extraídos das vendas)
      return { data: [] };
    }
  }

  // ==================== METAS ====================

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
