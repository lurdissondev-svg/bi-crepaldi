import bitrix24Service from '../services/bitrix24.service.js';
import belleService from '../services/belle.service.js';
import dashboardDBService from '../services/dashboard.db.service.js';
import leadSaleCorrelator from '../services/leadSaleCorrelator.js';
import syncService from '../services/sync.service.js';
import customerAnalyticsService from '../services/customer-analytics.service.js';
import { getDateRanges, formatCurrency, getDecade } from '../utils/dateUtils.js';
import logger from '../utils/logger.js';

export const dashboardController = {
  // ==================== RESUMO ====================

  async getResumo(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      const timer = Date.now();

      // Buscar dados em paralelo - leads do banco (rápido), resto da API
      const [
        leadsAnalytics,
        dealsAnalytics,
        faturamentoAtual,
        faturamentoAnterior,
      ] = await Promise.all([
        // Leads do banco de dados (muito mais rápido!)
        dashboardDBService.getLeadsAnalytics(startDate, endDate).catch(err => {
          logger.warn('[Resumo] Fallback leads para API:', err.message);
          return bitrix24Service.getLeadsAnalytics(startDate, endDate);
        }),
        bitrix24Service.getDealsAnalytics(startDate, endDate),
        belleService.getFaturamentoContasReceber(startDate, endDate, centrosCusto),
        belleService.getFaturamentoContasReceber(
          dateRanges.lastMonth.start,
          dateRanges.lastMonth.end,
          centrosCusto
        ),
      ]);

      logger.info(`[Resumo] Dados carregados em ${Date.now() - timer}ms`);

      // Calcular métricas
      const faturamentoTotal = faturamentoAtual.faturamentoTotal || 0;
      const faturamentoMesAnterior = faturamentoAnterior.faturamentoTotal || 0;
      const variacaoFaturamento = faturamentoMesAnterior > 0
        ? ((faturamentoTotal - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
        : 0;

      // Leads e conversões
      const leadsNovos = leadsAnalytics.categorized.new + leadsAnalytics.categorized.inProgress;
      const leadsAgendados = leadsAnalytics.categorized.converted;
      const pacientesNovoVenda = dealsAnalytics.won || 0;
      const ticketMedioPacienteNovo = dealsAnalytics.averageTicket || 0;

      // Buscar estatísticas de clientes recorrentes do banco de dados
      let returningStats;
      try {
        returningStats = await customerAnalyticsService.getReturningCustomerStats(startDate, endDate);
      } catch {
        returningStats = { returning_leads: 0, new_leads: 0, returning_rate: 0.3 };
      }

      // Calcular pacientes recorrentes baseado em dados reais quando disponíveis
      const returningRate = returningStats.returning_rate || 0.3;
      const leadsRecorrentes = returningStats.returning_leads || Math.floor(leadsAnalytics.total * returningRate);
      const leadsRecorrentesAgendados = Math.floor(leadsAgendados * returningRate);
      const pacientesRecorrentes = Math.floor(faturamentoAtual.quantidadeMovimentos * (1 - returningRate));
      const ticketMedioPacienteRecorrente = faturamentoAtual.ticketMedio || 0;

      // Desempenho por dezena
      const desempenhoDezena = [
        { dezena: '1ª dezena', mes_atual: 0, mes_anterior: 0 },
        { dezena: '2ª dezena', mes_atual: 0, mes_anterior: 0 },
        { dezena: '3ª dezena', mes_atual: 0, mes_anterior: 0 },
      ];

      // Agrupar faturamento por dezena
      (faturamentoAtual.faturamentoDiario || []).forEach(item => {
        const dezena = getDecade(item.data);
        desempenhoDezena[dezena - 1].mes_atual += parseFloat(item.valor) || 0;
      });

      (faturamentoAnterior.faturamentoDiario || []).forEach(item => {
        const dezena = getDecade(item.data);
        desempenhoDezena[dezena - 1].mes_anterior += parseFloat(item.valor) || 0;
      });

      res.json({
        success: true,
        data: {
          faturamento: {
            total: faturamentoTotal,
            totalFormatado: formatCurrency(faturamentoTotal),
            variacao: variacaoFaturamento.toFixed(2),
            mesAnterior: faturamentoMesAnterior,
          },
          pacienteNovo: {
            leadsNovos,
            leadsAgendados,
            pacientesVenda: pacientesNovoVenda,
            ticketMedio: ticketMedioPacienteNovo,
            ticketMedioFormatado: formatCurrency(ticketMedioPacienteNovo),
          },
          pacienteRecorrente: {
            leads: leadsRecorrentes,
            leadsAgendados: leadsRecorrentesAgendados,
            pacientes: pacientesRecorrentes,
            ticketMedio: ticketMedioPacienteRecorrente,
            ticketMedioFormatado: formatCurrency(ticketMedioPacienteRecorrente),
          },
          desempenhoDezena,
          procedimentosPorCategoria: faturamentoAtual.procedimentos?.slice(0, 10) || [],
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar resumo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do resumo',
        message: error.message,
      });
    }
  },

  // ==================== FATURAMENTO ====================

  async getFaturamento(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo, confirmado, profissional } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      // Data de hoje
    const today = new Date().toISOString().split('T')[0];

    const [
        faturamentoAtual,
        faturamentoMesAnterior,
        faturamentoAnoAtual,
        faturamentoAnoAnterior,
        faturamentoHoje,
        newPatientStatsMensal,
        newPatientStatsAnual,
      ] = await Promise.all([
        belleService.getFaturamentoContasReceber(startDate, endDate, centrosCusto),
        belleService.getFaturamentoContasReceber(
          dateRanges.lastMonth.start,
          dateRanges.lastMonth.end,
          centrosCusto
        ),
        belleService.getFaturamentoContasReceber(
          dateRanges.thisYear.start,
          dateRanges.thisYear.end,
          centrosCusto
        ),
        belleService.getFaturamentoContasReceber(
          dateRanges.lastYear.start,
          dateRanges.lastYear.end,
          centrosCusto
        ),
        // Busca TODAS as vendas de hoje sem filtro de estabelecimento
        belleService.getFaturamentoHoje(today),
        // Calcula porcentagem de pacientes novos vs recorrentes (mensal)
        dashboardDBService.getNewPatientRevenuePercentage(startDate, endDate, centrosCusto),
        // Calcula porcentagem de pacientes novos vs recorrentes (anual)
        dashboardDBService.getNewPatientRevenuePercentage(
          dateRanges.thisYear.start,
          dateRanges.thisYear.end,
          centrosCusto
        ),
      ]);

      // Faturamento mensal
      const faturamentoMensal = faturamentoAtual.faturamentoTotal || 0;
      const faturamentoMesAnteriorValor = faturamentoMesAnterior.faturamentoTotal || 0;
      const variacaoMensal = faturamentoMesAnteriorValor > 0
        ? ((faturamentoMensal - faturamentoMesAnteriorValor) / faturamentoMesAnteriorValor) * 100
        : 0;

      // Faturamento anual
      const faturamentoAnual = faturamentoAnoAtual.faturamentoTotal || 0;
      const faturamentoAnoAnteriorValor = faturamentoAnoAnterior.faturamentoTotal || 0;
      const variacaoAnual = faturamentoAnoAnteriorValor > 0
        ? ((faturamentoAnual - faturamentoAnoAnteriorValor) / faturamentoAnoAnteriorValor) * 100
        : 0;

      // % pacientes novos - calculado a partir dos dados reais do banco
      // Usa fallback para estimativas se os dados não estiverem disponíveis ainda
      const pacientesNovosPercentualMensal = newPatientStatsMensal.newPatientPercentage || 35;
      const pacientesNovosPercentualAnual = newPatientStatsAnual.newPatientPercentage || 30;

      // Crescimento
      const crescimentoMensal = {
        mesPassadoAnoAnterior: faturamentoMesAnteriorValor,
        mesAtual: faturamentoMensal,
        percentual: variacaoMensal,
      };

      const crescimentoAnual = {
        anoAnterior: faturamentoAnoAnteriorValor,
        anoAtual: faturamentoAnual,
        percentual: variacaoAnual,
      };

      res.json({
        success: true,
        data: {
          mensal: {
            valor: faturamentoMensal,
            valorFormatado: formatCurrency(faturamentoMensal),
            variacao: variacaoMensal.toFixed(2),
            mesAnterior: faturamentoMesAnteriorValor,
            mesAnteriorFormatado: formatCurrency(faturamentoMesAnteriorValor),
            pacientesNovosPercentual: pacientesNovosPercentualMensal,
          },
          anual: {
            valor: faturamentoAnual,
            valorFormatado: formatCurrency(faturamentoAnual),
            variacao: variacaoAnual.toFixed(2),
            anoAnterior: faturamentoAnoAnteriorValor,
            anoAnteriorFormatado: formatCurrency(faturamentoAnoAnteriorValor),
            pacientesNovosPercentual: pacientesNovosPercentualAnual,
          },
          crescimentoMensal,
          crescimentoAnual,
          vendasHoje: {
            valor: faturamentoHoje?.faturamentoTotal || 0,
            valorFormatado: formatCurrency(faturamentoHoje?.faturamentoTotal || 0),
            quantidade: faturamentoHoje?.quantidadeMovimentos || 0,
          },
          faturamentoDiario: faturamentoAtual.faturamentoDiario || [],
          faturamentoMensalHistorico: faturamentoAnoAtual.faturamentoMensal || [],
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar faturamento:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de faturamento',
        message: error.message,
      });
    }
  },

  // ==================== MARKETING ====================

  async getMarketing(req, res) {
    try {
      const { data_inicio, data_fim, tipo, fonte, origem, fase_lead } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      // Usar banco de dados como fonte primária (muito mais rápido!)
      let leadsAnalytics;
      const timer = Date.now();

      try {
        leadsAnalytics = await dashboardDBService.getLeadsAnalytics(startDate, endDate);
        logger.info(`[Marketing] Dados do PostgreSQL em ${Date.now() - timer}ms - ${leadsAnalytics.total} leads`);
      } catch (dbError) {
        // Fallback para API se o banco falhar
        logger.warn('[Marketing] Fallback para API Bitrix24:', dbError.message);
        leadsAnalytics = await bitrix24Service.getLeadsAnalytics(startDate, endDate);
        logger.info(`[Marketing] Dados da API em ${Date.now() - timer}ms`);
      }

      // Horário de chegada dos leads
      const horarioChegada = leadsAnalytics.byHour.map(item => ({
        hora: `${item.hour.toString().padStart(2, '0')}:00`,
        leads: item.count,
      }));

      // Taxa de conversão por origem do lead (campo UF_CRM_1692640693814)
      const taxaConversaoPorOrigem = leadsAnalytics.byOrigemLead.map(origem => ({
        origem: origem.name,
        origemId: origem.id,
        leads: origem.total,
        emAtendimento: origem.inProgress,
        desqualificados: origem.disqualified,
        retencaoFutura: 0, // Calcular com dados reais
        agendou: origem.converted,
        taxaConversao: origem.total > 0
          ? ((origem.converted / origem.total) * 100).toFixed(1) + '%'
          : '0%',
      }));

      // Total de leads por categoria (usando origem do lead UF_CRM_1692640693814)
      const semPreenchimento = leadsAnalytics.byOrigemLead
        .find(s => s.name === 'Não preenchido')?.total || 0;
      const iniciativaInterna = leadsAnalytics.byOrigemLead
        .find(s => s.name === 'Iniciativa Interna')?.total || 0;
      const iniciativaPaciente = leadsAnalytics.byOrigemLead
        .find(s => s.name === 'Iniciativa do paciente')?.total || 0;
      // "Outro" é o total menos as categorias conhecidas
      const outro = Math.max(0, leadsAnalytics.total - semPreenchimento - iniciativaInterna - iniciativaPaciente);

      const totalLeads = {
        total: leadsAnalytics.total,
        semPreenchimento,
        iniciativaInterna,
        iniciativaPaciente,
        outro,
      };

      // Leads em atendimento
      const leadsEmAtendimento = leadsAnalytics.categorized.inProgress;

      // Leads desqualificados
      const leadsDesqualificados = leadsAnalytics.categorized.disqualified;

      // Funil de conversão - calcular estágios
      const totalLeadsCount = leadsAnalytics.total;
      const qualificados = leadsAnalytics.categorized.inProgress + leadsAnalytics.categorized.converted;
      const agendados = leadsAnalytics.categorized.converted; // Assumindo que converted = agendou
      const atendidos = Math.floor(agendados * 0.85); // Estimativa - será calculado com dados reais na fase 2
      const convertidos = leadsAnalytics.categorized.converted;

      const conversionFunnel = [
        {
          stage: 'Total de Leads',
          count: totalLeadsCount,
          percentage: 100,
        },
        {
          stage: 'Qualificados',
          count: qualificados,
          percentage: totalLeadsCount > 0 ? (qualificados / totalLeadsCount) * 100 : 0,
          conversionFromPrevious: totalLeadsCount > 0 ? (qualificados / totalLeadsCount) * 100 : 0,
        },
        {
          stage: 'Agendados',
          count: agendados,
          percentage: totalLeadsCount > 0 ? (agendados / totalLeadsCount) * 100 : 0,
          conversionFromPrevious: qualificados > 0 ? (agendados / qualificados) * 100 : 0,
        },
        {
          stage: 'Atendidos',
          count: atendidos,
          percentage: totalLeadsCount > 0 ? (atendidos / totalLeadsCount) * 100 : 0,
          conversionFromPrevious: agendados > 0 ? (atendidos / agendados) * 100 : 0,
        },
        {
          stage: 'Convertidos',
          count: convertidos,
          percentage: totalLeadsCount > 0 ? (convertidos / totalLeadsCount) * 100 : 0,
          conversionFromPrevious: atendidos > 0 ? (convertidos / atendidos) * 100 : 0,
        },
      ];

      res.json({
        success: true,
        data: {
          horarioChegada,
          origemLead: {
            taxaConversaoPorOrigem,
            totalLeads,
          },
          leadsEmAtendimento: {
            total: leadsEmAtendimento,
          },
          leadsDesqualificados: {
            total: leadsDesqualificados,
          },
          conversionFunnel,
          byOrigemLead: leadsAnalytics.byOrigemLead,
          origemLeadMap: leadsAnalytics.origemLeadMap,
          byUtmSource: leadsAnalytics.byUtmSource,
          byUtmMedium: leadsAnalytics.byUtmMedium,
          byUtmCampaign: leadsAnalytics.byUtmCampaign,
          bySource: leadsAnalytics.bySource,
          statusDistribution: leadsAnalytics.statusDistribution,
          conversionRate: leadsAnalytics.conversionRate,
          heatmap: leadsAnalytics.heatmap,
          metrics: leadsAnalytics.metrics,
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar marketing:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de marketing',
        message: error.message,
      });
    }
  },

  // ==================== COMERCIAL ====================

  async getComercial(req, res) {
    try {
      const { data_inicio, data_fim, origem } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const timer = Date.now();

      const [leadsAnalytics, dealsAnalytics, faturamento] = await Promise.all([
        // Leads do banco de dados (muito mais rápido!)
        dashboardDBService.getLeadsAnalytics(startDate, endDate).catch(err => {
          logger.warn('[Comercial] Fallback leads para API:', err.message);
          return bitrix24Service.getLeadsAnalytics(startDate, endDate);
        }),
        bitrix24Service.getDealsAnalytics(startDate, endDate),
        belleService.getAnalyticsFaturamento(startDate, endDate, []),
      ]);

      logger.info(`[Comercial] Dados carregados em ${Date.now() - timer}ms`);

      // Conversão de venda por origem do lead (campo UF_CRM_1692640693814)
      const conversaoVendaPorOrigem = leadsAnalytics.byOrigemLead.map(origem => {
        // Buscar deals que vieram de leads com essa origem
        // Nota: deals não tem UF_CRM_1692640693814 diretamente, então usamos os leads correlacionados
        // Compatibilidade com banco (custom_fields.UF_CRM_1692640693814) e API (UF_CRM_1692640693814)
        const leadsFromOrigem = leadsAnalytics.rawLeads?.filter(l => {
          const origemId = l.UF_CRM_1692640693814 || l.custom_fields?.UF_CRM_1692640693814;
          return origemId === origem.id || (!origemId && origem.id === 'NAO_PREENCHIDO');
        }) || [];

        // Quantidade de leads convertidos desta origem
        // Compatibilidade com banco (status_semantica) e API (STATUS_SEMANTIC_ID)
        const convertedLeads = leadsFromOrigem.filter(l =>
          l.STATUS_ID === 'CONVERTED' ||
          l.STATUS_SEMANTIC_ID === 'S' ||
          l.status_semantica === 'success'
        ).length;

        // Estimar valor baseado na média do ticket
        const valorEstimado = convertedLeads * (dealsAnalytics.averageTicket || 0);

        return {
          origem: origem.name,
          origemId: origem.id,
          leads: origem.total,
          emAtendimento: origem.inProgress,
          convertidos: origem.converted,
          desqualificados: origem.disqualified,
          valor: valorEstimado,
          valorFormatado: formatCurrency(valorEstimado),
          taxaConversao: origem.total > 0
            ? ((origem.converted / origem.total) * 100).toFixed(1) + '%'
            : '0%',
        };
      });

      // Procedimentos por centro de custo
      const procedimentosPorCentro = {
        clinicaSpa: faturamento.procedimentos?.filter(p =>
          p.nome?.toLowerCase().includes('massagem') ||
          p.nome?.toLowerCase().includes('relaxante') ||
          p.nome?.toLowerCase().includes('drenagem')
        ) || [],
        belaLaser: faturamento.procedimentos?.filter(p =>
          p.nome?.toLowerCase().includes('depilação') ||
          p.nome?.toLowerCase().includes('laser') ||
          p.nome?.toLowerCase().includes('ultraforme')
        ) || [],
        convenios: [],
      };

      // Procedimentos de paciente novo
      const procedimentosPacienteNovo = {
        labels: faturamento.procedimentos?.slice(0, 15).map(p => p.nome) || [],
        vendas: faturamento.procedimentos?.slice(0, 15).map(p => p.quantidade) || [],
        faturamento: faturamento.procedimentos?.slice(0, 15).map(p => p.valor) || [],
      };

      res.json({
        success: true,
        data: {
          conversaoVendaPorOrigem,
          procedimentosPorCentro,
          procedimentosPacienteNovo,
          metas: {
            spa: {
              atual: faturamento.faturamentoTotal * 0.3,
              meta: 1060000,
            },
            convenios: {
              atual: 0,
              meta: 210000,
            },
            belaLaser: {
              atual: faturamento.faturamentoTotal * 0.1,
              meta: 100000,
            },
          },
          profissionais: faturamento.profissionais || [],
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar comercial:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados comerciais',
        message: error.message,
      });
    }
  },

  // ==================== ATENDIMENTO/PERFORMANCE ====================

  async getAtendimento(req, res) {
    try {
      const { data_inicio, data_fim, profissional } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const faturamento = await belleService.getAnalyticsFaturamento(
        startDate, endDate, []
      );

      // Desempenho por responsável
      const desempenho = faturamento.profissionais?.map(prof => ({
        responsavel: prof.nome,
        totalOrcamentos: prof.vendas * 1.2 | 0,
        valorTotalOrcado: prof.valor * 1.1,
        aprovados: prof.vendas,
        valorTotalAprovado: prof.valor,
        percentual: 98, // Calcular com dados reais
      })) || [];

      // Ticket médio por procedimento
      const ticketMedioPorProcedimento = faturamento.procedimentos?.map(proc => ({
        procedimento: proc.nome,
        ticketMedio: proc.quantidade > 0 ? proc.valor / proc.quantidade : 0,
        ticketMedioFormatado: formatCurrency(proc.quantidade > 0 ? proc.valor / proc.quantidade : 0),
        vendas: proc.quantidade,
        faturamentoTotal: proc.valor,
        faturamentoTotalFormatado: formatCurrency(proc.valor),
      })) || [];

      // Top 80/20 (Pareto)
      const totalFaturamento = faturamento.faturamentoTotal || 1;
      let acumulado = 0;
      const pareto8020 = ticketMedioPorProcedimento
        .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal)
        .map(item => {
          acumulado += item.faturamentoTotal;
          return {
            ...item,
            percentualAcumulado: ((acumulado / totalFaturamento) * 100).toFixed(2),
          };
        })
        .filter(item => parseFloat(item.percentualAcumulado) <= 80);

      res.json({
        success: true,
        data: {
          desempenho,
          ticketMedioPorProcedimento: ticketMedioPorProcedimento.slice(0, 20),
          pareto8020,
          totalFaturamento: faturamento.faturamentoTotal,
          totalFaturamentoFormatado: formatCurrency(faturamento.faturamentoTotal),
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar atendimento:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de atendimento',
        message: error.message,
      });
    }
  },

  // ==================== METAS ====================

  async getMetas(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const [metas, faturamento] = await Promise.all([
        belleService.getMetasByPeriodo(startDate, endDate),
        belleService.getAnalyticsFaturamento(startDate, endDate, []),
      ]);

      // Calcular progresso das metas por nível
      const metaSpa = {
        meta1: { expectativa: 43.48, realidade: 0, diaria: 0 },
        meta2: { expectativa: 43.48, realidade: 0, diaria: 0 },
        meta3: { expectativa: 43.48, realidade: 0, diaria: 0 },
      };

      res.json({
        success: true,
        data: {
          metaSpa,
          metasGerais: metas.data || [],
          progressoGeral: {
            faturamentoAtual: faturamento.faturamentoTotal,
            faturamentoAtualFormatado: formatCurrency(faturamento.faturamentoTotal),
          },
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar metas:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de metas',
        message: error.message,
      });
    }
  },

  // ==================== PACIENTES ====================

  async getPacientes(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisYear.start;
      const endDate = data_fim || dateRanges.thisYear.end;

      const pacientesAnalytics = await belleService.getAnalyticsPacientes(startDate, endDate);

      res.json({
        success: true,
        data: {
          faturamentoPaciente: pacientesAnalytics.faturamentoPorPaciente,
          potenciaisMais4Meses: pacientesAnalytics.potenciaisMais4Meses,
          potenciaisMenos4Meses: pacientesAnalytics.potenciaisMenos4Meses,
          totalClientes: pacientesAnalytics.totalClientes,
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar pacientes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de pacientes',
        message: error.message,
      });
    }
  },

  // ==================== CUSTOMER ANALYTICS ====================

  async getConversionMetrics(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const metrics = await customerAnalyticsService.getConversionMetrics(startDate, endDate);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas de conversão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas de conversão',
        message: error.message,
      });
    }
  },

  async getConversionFunnel(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const funnel = await customerAnalyticsService.getConversionFunnel(startDate, endDate);

      res.json({
        success: true,
        data: funnel,
      });
    } catch (error) {
      logger.error('Erro ao buscar funil de conversão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar funil de conversão',
        message: error.message,
      });
    }
  },

  async getReturningCustomerStats(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const stats = await customerAnalyticsService.getReturningCustomerStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Erro ao buscar estatísticas de clientes recorrentes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar estatísticas de clientes recorrentes',
        message: error.message,
      });
    }
  },

  async getRFMSegmentation(req, res) {
    try {
      const segments = await customerAnalyticsService.getRFMSegmentation();

      res.json({
        success: true,
        data: segments,
      });
    } catch (error) {
      logger.error('Erro ao buscar segmentação RFM:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar segmentação RFM',
        message: error.message,
      });
    }
  },

  async getTopCustomersByLTV(req, res) {
    try {
      const { limit } = req.query;
      const customers = await customerAnalyticsService.getTopCustomersByLTV(parseInt(limit) || 20);

      res.json({
        success: true,
        data: customers,
      });
    } catch (error) {
      logger.error('Erro ao buscar top clientes por LTV:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar top clientes por LTV',
        message: error.message,
      });
    }
  },

  // ==================== LEAD-SALE CORRELATION ====================

  async getLeadSaleCorrelation(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      // Fetch leads and sales in parallel
      const [leadsAnalytics, vendasData] = await Promise.all([
        bitrix24Service.getLeadsAnalytics(startDate, endDate),
        belleService.getVendasTodosEstabelecimentos(startDate, endDate),
      ]);

      // Flatten sales from all establishments
      const allSales = [];
      vendasData.forEach(estab => {
        if (estab.data && Array.isArray(estab.data)) {
          estab.data.forEach(sale => {
            allSales.push({
              ...sale,
              estabelecimento: estab.estabelecimento,
            });
          });
        }
      });

      // Correlate leads with sales
      const correlatedLeads = leadSaleCorrelator.correlateWithSales(
        leadsAnalytics.rawLeads || [],
        allSales,
        'both'
      );

      // Calculate ROI metrics
      const roiBySource = leadSaleCorrelator.calculateROIBySource(correlatedLeads);
      const roiByCampaign = leadSaleCorrelator.calculateROIByCampaign(correlatedLeads);
      const summary = leadSaleCorrelator.getSummary(correlatedLeads);

      res.json({
        success: true,
        data: {
          summary,
          roiBySource,
          roiByCampaign,
          period: {
            startDate,
            endDate,
          },
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar correlação lead-venda:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar correlação lead-venda',
        message: error.message,
      });
    }
  },

  // ==================== FILTROS ====================

  async getFilterOptions(req, res) {
    try {
      const [
        leadStatuses,
        leadSources,
        dealStages,
        dealCategories,
        centrosCusto,
        profissionais,
      ] = await Promise.all([
        bitrix24Service.getLeadStatuses(),
        bitrix24Service.getLeadSources(),
        bitrix24Service.getDealStages(),
        bitrix24Service.getDealCategories(),
        belleService.getCentrosCusto(),
        belleService.getProfissionais(),
      ]);

      // Origem do lead (campo UF_CRM_1692640693814) - opções disponíveis
      const origemLeadOptions = Object.entries(bitrix24Service.origemLeadMap).map(([id, name]) => ({
        id,
        name,
      }));

      res.json({
        success: true,
        data: {
          leadStatuses,
          leadSources,
          origemLeadOptions, // Opções do campo "Origem do lead" (UF_CRM_1692640693814)
          dealStages,
          dealCategories,
          centrosCusto: centrosCusto.data || [],
          profissionais: profissionais.data || [],
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar opções de filtro:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar opções de filtro',
        message: error.message,
      });
    }
  },

  // ==================== SYNC STATUS ====================

  async getSyncStatus(req, res) {
    try {
      const status = syncService.getSyncStatus();

      // If in-memory state is empty, try to get from database
      let lastSyncAt = status.lastSyncAt;
      let nextSyncAt = status.nextSyncAt;
      let lastSyncStatus = status.lastSyncStatus;
      let isRunning = status.isRunning;

      if (!lastSyncAt) {
        try {
          const dbStatus = await dashboardDBService.getLastSyncInfo();
          if (dbStatus) {
            lastSyncAt = dbStatus.lastSyncAt;
            lastSyncStatus = dbStatus.lastSyncStatus;
            isRunning = isRunning || dbStatus.hasRunningSyncs;
            // Calculate next sync time based on last sync + interval
            if (lastSyncAt && !nextSyncAt) {
              const lastTime = new Date(lastSyncAt).getTime();
              const intervalMs = (status.intervalMinutes || 15) * 60 * 1000;
              nextSyncAt = new Date(lastTime + intervalMs);
            }
          }
        } catch (dbErr) {
          logger.debug('[Sync Status] Could not get DB fallback:', dbErr.message);
        }
      }

      logger.debug('[Sync Status]', JSON.stringify({ isRunning, lastSyncAt, nextSyncAt, lastSyncStatus }));
      res.json({
        success: true,
        data: {
          isRunning: isRunning || false,
          lastSyncAt: lastSyncAt || null,
          nextSyncAt: nextSyncAt || null,
          lastSyncStatus: lastSyncStatus || null,
          intervalMinutes: status.intervalMinutes || 15,
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar status do sync:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar status do sync',
        message: error.message,
      });
    }
  },
};

export default dashboardController;
