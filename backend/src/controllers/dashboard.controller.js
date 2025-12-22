import bitrix24Service from '../services/bitrix24.service.js';
import belleService from '../services/belle.service.js';
import dashboardDBService from '../services/dashboard.db.service.js';
import leadSaleCorrelator from '../services/leadSaleCorrelator.js';
import syncService from '../services/sync.service.js';
import customerAnalyticsService from '../services/customer-analytics.service.js';
import indicadores8psService from '../services/indicadores8ps.service.js';
import alertas8psService from '../services/alertas8ps.service.js';
import { getDateRanges, formatCurrency, getDecade } from '../utils/dateUtils.js';
import { getInfoDiasUteis, contarDiasUteisPassados, contarDiasUteisRestantes } from '../utils/businessDays.js';
import { getBusinessDaysForPeriod } from './businessDays.controller.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

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

      // TUDO DO BANCO - sem chamadas a APIs externas (Bitrix24/Belle offline)
      const [
        leadsAnalytics,
        dealsWonData,
        faturamentoAtual,
        faturamentoAnterior,
      ] = await Promise.all([
        // Leads do banco de dados
        dashboardDBService.getLeadsAnalytics(startDate, endDate),
        // Deals WON do banco (substitui bitrix24Service.getDealsAnalytics)
        dashboardDBService.getDealsWonFromDB(startDate, endDate).catch(() => ({
          leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0
        })),
        // Faturamento do banco (substitui belleService.getFaturamentoContasReceber)
        dashboardDBService.getFaturamentoFromDB(startDate, endDate, centrosCusto),
        // Faturamento mês anterior do banco
        dashboardDBService.getFaturamentoFromDB(
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
      const pacientesNovoVenda = dealsWonData.wonDealsCount || 0;
      const ticketMedioPacienteNovo = dealsWonData.wonDealsCount > 0
        ? (dealsWonData.wonDealsValue / dealsWonData.wonDealsCount)
        : 0;

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

      // Detecta se o período selecionado é maior que um mês (35 dias)
      const diffDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
      const isPeriodoLongo = diffDays > 35;

      // Helper para buscar faturamento: tenta banco primeiro, fallback para API
      const getFaturamentoWithFallback = async (start, end, estabs = []) => {
        // Tenta buscar do banco primeiro
        const dbData = await dashboardDBService.getFaturamentoFromDB(start, end, estabs);
        if (dbData && dbData.faturamentoTotal > 0) {
          logger.debug(`[Faturamento] Usando dados do banco para ${start} a ${end}`);
          return dbData;
        }
        // Fallback para API Belle
        logger.debug(`[Faturamento] Fallback para API para ${start} a ${end}`);
        return belleService.getFaturamentoContasReceber(start, end, estabs);
      };

      const [
        faturamentoAtual,
        faturamentoMesAtual, // Sempre o mês atual (para quando período é longo)
        faturamentoMesAnterior,
        faturamentoAnoAtual,
        faturamentoAnoAnterior,
        faturamentoHoje,
        faturamentoMensalHistorico,
        faturamentoDiarioData,
        newPatientStatsMensal,
        newPatientStatsAnual,
      ] = await Promise.all([
        getFaturamentoWithFallback(startDate, endDate, centrosCusto),
        // Busca o mês atual (usado quando período selecionado é longo)
        getFaturamentoWithFallback(
          dateRanges.thisMonth.start,
          dateRanges.thisMonth.end,
          centrosCusto
        ),
        getFaturamentoWithFallback(
          dateRanges.lastMonth.start,
          dateRanges.lastMonth.end,
          centrosCusto
        ),
        getFaturamentoWithFallback(
          dateRanges.thisYear.start,
          dateRanges.thisYear.end,
          centrosCusto
        ),
        getFaturamentoWithFallback(
          dateRanges.lastYear.start,
          dateRanges.lastYear.end,
          centrosCusto
        ),
        // Busca TODAS as vendas de hoje sem filtro de estabelecimento
        belleService.getFaturamentoHoje(today),
        // Busca histórico mensal do banco (para gráfico de barras anual)
        dashboardDBService.getFaturamentoMensalFromDB(
          dateRanges.thisYear.start,
          dateRanges.thisYear.end,
          centrosCusto
        ),
        // Busca faturamento diário do período selecionado
        dashboardDBService.getFaturamentoDiarioFromDB(startDate, endDate, centrosCusto),
        // Calcula porcentagem de pacientes novos vs recorrentes (mensal - mês atual)
        dashboardDBService.getNewPatientRevenuePercentage(
          dateRanges.thisMonth.start,
          dateRanges.thisMonth.end,
          centrosCusto
        ),
        // Calcula porcentagem de pacientes novos vs recorrentes (anual/período)
        dashboardDBService.getNewPatientRevenuePercentage(startDate, endDate, centrosCusto),
      ]);

      // Faturamento mensal
      // Se o período é longo (> 35 dias), usa o mês atual para o card mensal
      // Se o período é curto, usa o período selecionado
      const faturamentoMensal = isPeriodoLongo
        ? (faturamentoMesAtual.faturamentoTotal || 0)
        : (faturamentoAtual.faturamentoTotal || 0);
      const faturamentoMesAnteriorValor = faturamentoMesAnterior.faturamentoTotal || 0;
      const variacaoMensal = faturamentoMesAnteriorValor > 0
        ? ((faturamentoMensal - faturamentoMesAnteriorValor) / faturamentoMesAnteriorValor) * 100
        : 0;

      // Faturamento anual/período
      // Se o período é longo, usa o período selecionado para o card anual
      // Se o período é curto, usa o ano atual
      const faturamentoAnual = isPeriodoLongo
        ? (faturamentoAtual.faturamentoTotal || 0)
        : (faturamentoAnoAtual.faturamentoTotal || 0);
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
          // Flag para frontend saber se está mostrando período longo
          isPeriodoLongo,
          periodoSelecionado: { inicio: startDate, fim: endDate, dias: diffDays },
          mensal: {
            valor: faturamentoMensal,
            valorFormatado: formatCurrency(faturamentoMensal),
            variacao: variacaoMensal.toFixed(2),
            mesAnterior: faturamentoMesAnteriorValor,
            mesAnteriorFormatado: formatCurrency(faturamentoMesAnteriorValor),
            pacientesNovosPercentual: pacientesNovosPercentualMensal,
            // Indica qual período está sendo mostrado no card mensal
            label: isPeriodoLongo ? 'Mês Atual' : 'Período Selecionado',
          },
          anual: {
            valor: faturamentoAnual,
            valorFormatado: formatCurrency(faturamentoAnual),
            variacao: variacaoAnual.toFixed(2),
            anoAnterior: faturamentoAnoAnteriorValor,
            anoAnteriorFormatado: formatCurrency(faturamentoAnoAnteriorValor),
            pacientesNovosPercentual: pacientesNovosPercentualAnual,
            // Indica qual período está sendo mostrado no card anual
            label: isPeriodoLongo ? 'Período Selecionado' : 'Ano Atual',
          },
          crescimentoMensal,
          crescimentoAnual,
          vendasHoje: {
            valor: faturamentoHoje?.faturamentoTotal || 0,
            valorFormatado: formatCurrency(faturamentoHoje?.faturamentoTotal || 0),
            quantidade: faturamentoHoje?.quantidadeMovimentos || 0,
          },
          // Faturamento diário - prioriza dados do banco, fallback para API
          faturamentoDiario: faturamentoDiarioData.length > 0
            ? faturamentoDiarioData.map(row => ({
                data: row.data_referencia,
                valor: parseFloat(row.faturamento_bruto) || 0,
              }))
            : (faturamentoAtual.faturamentoDiario || []),
          // Histórico mensal do ano - sempre do banco
          faturamentoMensalHistorico: faturamentoMensalHistorico || [],
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
      let dealsWonData = { leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0 };
      let dealsLostData = { byMotivoDesqualificacao: [], lostDealsCount: 0 };
      let procedimentosMaisVendidos = []; // Por faturamento (valor)
      let procedimentosMaisQuantidade = []; // Por quantidade vendida
      let procedimentosPorEstabelecimento = {}; // Rankings por estabelecimento
      let profissionaisMaisVendas = [];
      const timer = Date.now();

      try {
        // Buscar TUDO do banco de dados (instantâneo!)
        // Deals WON e LOST agora vêm do PostgreSQL em vez de chamadas lentas à API Bitrix24
        const [dbLeads, wonDeals, lostDeals, dbProcedimentos, dbProcsByQtd, dbProcsPorEstab, apiProfissionais, motivosDesqualificacao] = await Promise.all([
          dashboardDBService.getLeadsAnalytics(startDate, endDate),
          // DEALS WON DO BANCO (antes era bitrix24Service.getDealsWonByLeads - lento!)
          dashboardDBService.getDealsWonFromDB(startDate, endDate).catch(err => {
            logger.warn('[Marketing] Erro ao buscar deals WON do banco:', err.message);
            return { leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0 };
          }),
          // DEALS LOST DO BANCO (antes era bitrix24Service.getDealsLostByMotivoDesqualificacao - lento!)
          dashboardDBService.getDealsLostFromDB(startDate, endDate).catch(err => {
            logger.warn('[Marketing] Erro ao buscar deals LOST do banco:', err.message);
            return { byMotivoDesqualificacao: [], lostDealsCount: 0 };
          }),
          // Procedimentos por VALOR - tenta cache primeiro, fallback para API Belle
          dashboardDBService.getProcedimentosFromCache(startDate, endDate, 20).then(data => {
            if (data && data.length > 0) return data;
            // Se cache vazio, busca da API Belle
            return belleService.getProcedimentosFromAPIs(startDate, endDate, 20).catch(() => []);
          }).catch(() => belleService.getProcedimentosFromAPIs(startDate, endDate, 20).catch(() => [])),
          // Procedimentos ordenados por QUANTIDADE vendida
          dashboardDBService.getProcedimentosByQuantidade(startDate, endDate, 20).catch(() => []),
          // Procedimentos agrupados POR ESTABELECIMENTO (top por valor e quantidade para cada unidade)
          dashboardDBService.getProcedimentosPorEstabelecimento(startDate, endDate, 10).catch(() => ({})),
          // Profissionais - tenta cache primeiro, fallback para API Belle
          dashboardDBService.getProfissionaisFromCache(startDate, endDate, 20).then(data => {
            if (data && data.length > 0) return data;
            // Se cache vazio, busca da API Belle
            return belleService.getProfissionaisFromAPIs(startDate, endDate, 20).catch(() => []);
          }).catch(() => belleService.getProfissionaisFromAPIs(startDate, endDate, 20).catch(() => [])),
          // Buscar motivos de desqualificação pela data de MODIFICAÇÃO (quando o lead foi desqualificado)
          dashboardDBService.getMotivosDesqualificacao(startDate, endDate).catch(err => {
            logger.warn('[Marketing] Erro ao buscar motivos desqualificação:', err.message);
            return { byMotivoDesqualificacao: [], totalDesqualificados: 0 };
          }),
        ]);
        leadsAnalytics = dbLeads;
        dealsWonData = wonDeals;
        dealsLostData = lostDeals;
        // Procedimentos vêm do cache ou da API Belle (extrai de servicos em venda_planos)
        procedimentosMaisVendidos = dbProcedimentos; // Por faturamento
        procedimentosMaisQuantidade = dbProcsByQtd; // Por quantidade vendida
        procedimentosPorEstabelecimento = dbProcsPorEstab; // Por estabelecimento
        profissionaisMaisVendas = apiProfissionais;
        // Substituir byMotivoDesqualificacao pelo novo método que usa bitrix_modified_at
        leadsAnalytics.byMotivoDesqualificacao = motivosDesqualificacao.byMotivoDesqualificacao;
        logger.info(`[Marketing] Dados carregados em ${Date.now() - timer}ms - ${leadsAnalytics.total} leads, ${dealsWonData.wonDealsCount} deals WON, ${dealsLostData.lostDealsCount} deals LOST, ${procedimentosMaisVendidos.length} procedimentos, ${profissionaisMaisVendas.length} profissionais, ${motivosDesqualificacao.totalDesqualificados} desqualificados`);
      } catch (dbError) {
        // Fallback para API APENAS para leads (mantém banco para deals que já estão sincronizados)
        logger.warn('[Marketing] Fallback para API Bitrix24 (leads apenas):', dbError.message);
        const [apiLeads, apiProcs, apiProfs] = await Promise.all([
          bitrix24Service.getLeadsAnalytics(startDate, endDate),
          belleService.getProcedimentosFromAPIs(startDate, endDate, 20).catch(() => []),
          belleService.getProfissionaisFromAPIs(startDate, endDate, 20).catch(() => []),
        ]);
        leadsAnalytics = apiLeads;
        // Deals continuam zerados se o banco falhar - não fazer chamada lenta à API
        dealsWonData = { leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0 };
        dealsLostData = { byMotivoDesqualificacao: [], lostDealsCount: 0 };
        procedimentosMaisVendidos = apiProcs;
        profissionaisMaisVendas = apiProfs;
        logger.info(`[Marketing] Dados da API em ${Date.now() - timer}ms`);
      }

      // Enriquecer byCampanhaBitrix com dados de conversão real (Deal WON)
      const leadsWonSet = new Set(dealsWonData.leadsComDealWon);
      if (leadsAnalytics.rawLeads && leadsAnalytics.byCampanhaBitrix) {
        const convertidosPorCampanha = {};
        leadsAnalytics.rawLeads.forEach(lead => {
          const leadId = String(lead.bitrix_id || lead.id);
          if (leadsWonSet.has(leadId)) {
            const customFields = lead.custom_fields || {};
            const campanhaId = customFields.UF_CRM_1729176132205 || 'NAO_PREENCHIDO';
            convertidosPorCampanha[campanhaId] = (convertidosPorCampanha[campanhaId] || 0) + 1;
          }
        });

        // Atualizar contagem de convertidos em cada campanha
        leadsAnalytics.byCampanhaBitrix = leadsAnalytics.byCampanhaBitrix.map(campanha => ({
          ...campanha,
          convertidos: convertidosPorCampanha[campanha.id] || 0,
        }));
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
          byCampanhaBitrix: leadsAnalytics.byCampanhaBitrix,
          campanhaMap: leadsAnalytics.campanhaMap,
          bySource: leadsAnalytics.bySource,
          statusDistribution: leadsAnalytics.statusDistribution,
          byMotivoDesqualificacao: leadsAnalytics.byMotivoDesqualificacao,
          conversionRate: leadsAnalytics.conversionRate,
          heatmap: leadsAnalytics.heatmap,
          metrics: leadsAnalytics.metrics,
          rawLeads: leadsAnalytics.rawLeads,
          leadsComDealWon: dealsWonData.leadsComDealWon, // Lista de IDs de leads que viraram Deal WON
          wonDealsCount: dealsWonData.wonDealsCount,
          wonDealsValue: dealsWonData.wonDealsValue,
          // Motivos de desqualificação de DEALS perdidos (complementa leads)
          dealsLostByMotivoDesqualificacao: dealsLostData.byMotivoDesqualificacao,
          lostDealsCount: dealsLostData.lostDealsCount,
          procedimentosMaisVendidos, // Top procedimentos por FATURAMENTO
          procedimentosMaisQuantidade, // Top procedimentos por QUANTIDADE vendida
          procedimentosPorEstabelecimento, // Rankings por estabelecimento (byValor, byQuantidade)
          profissionaisMaisVendas, // Top profissionais da API Belle
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

      // TUDO DO BANCO - sem chamadas a APIs externas (Bitrix24/Belle offline)
      const [leadsAnalytics, dealsWonData, faturamento, profissionaisData, procedimentosData] = await Promise.all([
        // Leads do banco de dados
        dashboardDBService.getLeadsAnalytics(startDate, endDate),
        // Deals WON do banco (substitui bitrix24Service.getDealsAnalytics)
        dashboardDBService.getDealsWonFromDB(startDate, endDate).catch(() => ({
          leadsComDealWon: [], wonDealsCount: 0, wonDealsValue: 0
        })),
        // Faturamento do banco (substitui belleService.getAnalyticsFaturamento)
        dashboardDBService.getFaturamentoFromDB(startDate, endDate, []),
        // Profissionais por vendas
        dashboardDBService.getProfissionaisFromVendas(startDate, endDate, 50).catch(() => []),
        // Procedimentos por estabelecimento
        dashboardDBService.getProcedimentosPorEstabelecimentoFromVendas(startDate, endDate, 100).catch(() => ({})),
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

        // Calcular ticket médio a partir dos deals do banco
        const averageTicket = dealsWonData.wonDealsCount > 0
          ? (dealsWonData.wonDealsValue / dealsWonData.wonDealsCount)
          : 0;
        // Estimar valor baseado na média do ticket
        const valorEstimado = convertedLeads * averageTicket;

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

      // Consolidar procedimentos de todos os estabelecimentos
      const todosProcedimentos = [];
      Object.entries(procedimentosData || {}).forEach(([estabNome, dados]) => {
        const procs = dados?.byValor || dados?.byQuantidade || [];
        procs.forEach(p => {
          todosProcedimentos.push({
            ...p,
            estabelecimento: estabNome,
          });
        });
      });

      // Procedimentos por centro de custo (baseado no cod_estab)
      const procedimentosPorCentro = {
        clinicaSpa: Object.entries(procedimentosData || {})
          .filter(([nome]) => nome.toLowerCase().includes('spa') || nome.toLowerCase().includes('estética') || nome.toLowerCase().includes('dermato'))
          .flatMap(([, dados]) => dados?.byValor || []),
        belaLaser: Object.entries(procedimentosData || {})
          .filter(([nome]) => nome.toLowerCase().includes('bela') || nome.toLowerCase().includes('laser'))
          .flatMap(([, dados]) => dados?.byValor || []),
        convenios: Object.entries(procedimentosData || {})
          .filter(([nome]) => nome.toLowerCase().includes('convên') || nome.toLowerCase().includes('convenio'))
          .flatMap(([, dados]) => dados?.byValor || []),
      };

      // Procedimentos de paciente novo (top 15 por valor)
      const topProcedimentos = todosProcedimentos
        .sort((a, b) => (b.valor || 0) - (a.valor || 0))
        .slice(0, 15);

      const procedimentosPacienteNovo = {
        labels: topProcedimentos.map(p => p.nome || p.procedimento) || [],
        vendas: topProcedimentos.map(p => p.quantidade || 0) || [],
        faturamento: topProcedimentos.map(p => p.valor || 0) || [],
      };

      // Calcular faturamento por estabelecimento para metas
      let spaAtual = 0;
      let conveniosAtual = 0;
      let belaLaserAtual = 0;

      if (faturamento.porEstabelecimento) {
        faturamento.porEstabelecimento.forEach(estab => {
          const nomeEstab = (estab.estabelecimento || '').toLowerCase();
          if (nomeEstab.includes('conv')) {
            conveniosAtual += estab.valor || 0;
          } else if (nomeEstab.includes('bela') || nomeEstab.includes('laser')) {
            belaLaserAtual += estab.valor || 0;
          } else if (nomeEstab.includes('spa') || nomeEstab.includes('clinic')) {
            spaAtual += estab.valor || 0;
          } else {
            // Default para SPA se não identificado
            spaAtual += estab.valor || 0;
          }
        });
      }

      // Profissionais: usa dados do banco de vendas
      const profissionais = profissionaisData || [];

      res.json({
        success: true,
        data: {
          conversaoVendaPorOrigem,
          procedimentosPorCentro,
          procedimentosPacienteNovo,
          metas: {
            spa: {
              atual: spaAtual,
              meta: 1060000,
            },
            convenios: {
              atual: conveniosAtual,
              meta: 210000,
            },
            belaLaser: {
              atual: belaLaserAtual,
              meta: 100000,
            },
          },
          profissionais,
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

      // TUDO DO BANCO - usar funções corretas que retornam profissionais e procedimentos
      const [faturamento, profissionaisData, procedimentosData] = await Promise.all([
        dashboardDBService.getFaturamentoFromDB(startDate, endDate, []),
        dashboardDBService.getProfissionaisFromVendas(startDate, endDate, 50),
        dashboardDBService.getProcedimentosPorEstabelecimentoFromVendas(startDate, endDate, 100),
      ]);

      // Desempenho por responsável - usar dados de profissionaisData
      const desempenho = profissionaisData.map(prof => ({
        responsavel: prof.nome,
        totalOrcamentos: Math.round((prof.vendas || 0) * 1.2),
        valorTotalOrcado: (prof.valor || 0) * 1.1,
        aprovados: prof.vendas || 0,
        valorTotalAprovado: prof.valor || 0,
        percentual: 98,
      }));

      // Consolidar procedimentos de todos os estabelecimentos
      // procedimentosData tem estrutura: { "Estab": { byValor: [], byQuantidade: [] } }
      const procedimentosMap = new Map();
      Object.values(procedimentosData || {}).forEach(estabelecimento => {
        const procs = estabelecimento?.byValor || [];
        procs.forEach(proc => {
          const key = proc.nome || proc.procedimento;
          if (!key) return;
          if (procedimentosMap.has(key)) {
            const existing = procedimentosMap.get(key);
            existing.quantidade += proc.quantidade || 0;
            existing.valor += proc.valor || 0;
          } else {
            procedimentosMap.set(key, {
              nome: key,
              quantidade: proc.quantidade || 0,
              valor: proc.valor || 0,
            });
          }
        });
      });

      // Ticket médio por procedimento
      const ticketMedioPorProcedimento = Array.from(procedimentosMap.values()).map(proc => ({
        procedimento: proc.nome,
        ticketMedio: proc.quantidade > 0 ? proc.valor / proc.quantidade : 0,
        ticketMedioFormatado: formatCurrency(proc.quantidade > 0 ? proc.valor / proc.quantidade : 0),
        vendas: proc.quantidade,
        faturamentoTotal: proc.valor,
        faturamentoTotalFormatado: formatCurrency(proc.valor),
      })).sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);

      // Top 80/20 (Pareto)
      const totalFaturamento = faturamento?.faturamentoTotal || 1;
      let acumulado = 0;
      const pareto8020 = ticketMedioPorProcedimento
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
          totalFaturamento: faturamento?.faturamentoTotal || 0,
          totalFaturamentoFormatado: formatCurrency(faturamento?.faturamentoTotal || 0),
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

      // Buscar faturamento por categoria de meta (SPA, Convênios, Bela Laser, Nutrologia)
      // Usar a função do Belle que já implementa o filtro de profissional para Dermato
      const metasConfig = config.metas;

      // Buscar faturamento do banco para os estabelecimentos principais
      const faturamento = await dashboardDBService.getFaturamentoFromDB(startDate, endDate, []);

      const faturamentoPorCategoria = { spa: 0, convenios: 0, belaLaser: 0, nutrologia: 0 };

      if (faturamento && faturamento.porEstabelecimento) {
        faturamento.porEstabelecimento.forEach(estab => {
          const codestab = parseInt(estab.codestab);

          // Usar codestabs da configuração para classificar
          if (metasConfig.spa.codestabs.includes(codestab)) {
            faturamentoPorCategoria.spa += estab.valor || 0;
          } else if (metasConfig.convenios.codestabs.includes(codestab)) {
            faturamentoPorCategoria.convenios += estab.valor || 0;
          } else if (metasConfig.belaLaser.codestabs.includes(codestab)) {
            faturamentoPorCategoria.belaLaser += estab.valor || 0;
          } else if (metasConfig.nutrologia.codestabs.includes(codestab)) {
            faturamentoPorCategoria.nutrologia += estab.valor || 0;
          }
          // Nota: Dermato (1) é filtrado por profissional abaixo
          // Drips (10) não está configurado em nenhuma meta
        });
      }

      // Buscar faturamento de Dermato filtrado por profissional (DRA KELLY DA CAS) para SPA
      try {
        const dermatoResult = await belleService.getFaturamentoDermatoPorProfissional(
          startDate,
          endDate,
          metasConfig.spa.dermatoProfissional
        );
        faturamentoPorCategoria.spa += dermatoResult.filtrado || 0;
        logger.info(`[Metas] Dermato (${metasConfig.spa.dermatoProfissional}): R$ ${(dermatoResult.filtrado || 0).toFixed(2)} adicionado ao SPA`);
      } catch (dermatoError) {
        logger.warn('[Metas] Não foi possível buscar faturamento de Dermato por profissional:', dermatoError.message);
      }

      // Buscar dias úteis configurados no banco (ou calcula automaticamente)
      const totalDias = await getBusinessDaysForPeriod(startDate, endDate);

      // Calcular dias passados e restantes proporcionalmente
      const start = new Date(startDate);
      const end = new Date(endDate);
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);

      const lastDay = end.getDate();
      const dayOfMonth = Math.min(hoje.getDate(), lastDay);
      const proportion = dayOfMonth / lastDay;

      // Calcular dias passados e restantes baseado na proporção do mês
      const diasPassados = Math.round(totalDias * proportion);
      const diasRestantes = Math.max(0, totalDias - diasPassados);

      // Calcular expectativa (% esperado até hoje baseado nos dias úteis passados)
      const expectativaPct = totalDias > 0 ? (diasPassados / totalDias) * 100 : 0;

      // Função para calcular realidade e diária para cada meta
      const calcularMeta = (metaValor, faturamentoAtual) => {
        const realidade = metaValor > 0 ? (faturamentoAtual / metaValor) * 100 : 0;
        const faltaParaMeta = Math.max(0, metaValor - faturamentoAtual);
        const diaria = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;
        return {
          expectativa: parseFloat(expectativaPct.toFixed(2)),
          realidade: parseFloat(realidade.toFixed(2)),
          diaria: parseFloat(diaria.toFixed(2)),
          metaValor,
          metaValorFormatado: formatCurrency(metaValor),
          faturamentoAtual,
          faturamentoAtualFormatado: formatCurrency(faturamentoAtual),
          diasRestantes,
        };
      };

      // Função para criar objeto de metas de um estabelecimento
      const criarMetasEstabelecimento = (categoria, faturamentoAtual) => {
        const metasConfig = config.metas[categoria];
        return {
          nome: metasConfig.nome,
          faturamentoAtual,
          faturamentoAtualFormatado: formatCurrency(faturamentoAtual),
          meta1: calcularMeta(metasConfig.metas.meta1, faturamentoAtual),
          meta2: calcularMeta(metasConfig.metas.meta2, faturamentoAtual),
          meta3: calcularMeta(metasConfig.metas.meta3, faturamentoAtual),
        };
      };

      // Criar metas para cada estabelecimento
      const metaSpa = criarMetasEstabelecimento('spa', faturamentoPorCategoria.spa);
      const metaConvenios = criarMetasEstabelecimento('convenios', faturamentoPorCategoria.convenios);
      const metaBelaLaser = criarMetasEstabelecimento('belaLaser', faturamentoPorCategoria.belaLaser);
      const metaNutrologia = criarMetasEstabelecimento('nutrologia', faturamentoPorCategoria.nutrologia);

      // Faturamento total de todas as categorias
      const faturamentoTotal = faturamentoPorCategoria.spa +
                               faturamentoPorCategoria.convenios +
                               faturamentoPorCategoria.belaLaser +
                               faturamentoPorCategoria.nutrologia;

      res.json({
        success: true,
        data: {
          metaSpa,
          metaConvenios,
          metaBelaLaser,
          metaNutrologia,
          progressoGeral: {
            faturamentoTotal,
            faturamentoTotalFormatado: formatCurrency(faturamentoTotal),
            diasPassados,
            diasRestantes,
            totalDias,
            expectativaPct: parseFloat(expectativaPct.toFixed(2)),
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
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisYear.start;
      const endDate = data_fim || dateRanges.thisYear.end;
      const centrosCusto = centros_custo ? centros_custo.split(',').map(Number) : [];

      const timer = Date.now();

      // Usar banco de dados como fonte primária (muito mais rápido e tem nome do cliente!)
      let pacientesAnalytics;
      try {
        pacientesAnalytics = await dashboardDBService.getPacientesAnalyticsFromDB(startDate, endDate, centrosCusto);
        logger.info(`[Pacientes] Dados do PostgreSQL em ${Date.now() - timer}ms - ${pacientesAnalytics.totalClientes} clientes`);
      } catch (dbError) {
        // Fallback para API Belle se o banco falhar
        logger.warn('[Pacientes] Fallback para API Belle:', dbError.message);
        const belleData = await belleService.getAnalyticsPacientes(startDate, endDate);
        pacientesAnalytics = {
          faturamentoPaciente: belleData.faturamentoPorPaciente,
          potenciaisMais4Meses: belleData.potenciaisMais4Meses,
          potenciaisMenos4Meses: belleData.potenciaisMenos4Meses,
          totalClientes: belleData.totalClientes,
        };
      }

      res.json({
        success: true,
        data: pacientesAnalytics,
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

  async getInactivePatients(req, res) {
    try {
      const { days, limit } = req.query;
      const inactiveDays = parseInt(days) || 120; // 4 meses default
      const resultLimit = parseInt(limit) || 50;

      const patients = await customerAnalyticsService.getInactivePatients(inactiveDays, resultLimit);

      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Erro ao buscar pacientes inativos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar pacientes inativos',
        message: error.message,
      });
    }
  },

  /**
   * Retorna pacientes inativos com threshold dinâmico baseado em percentil
   * Útil quando os dados não cobrem 4 meses
   */
  async getInactivePatientsDynamic(req, res) {
    try {
      const { percentile, limit } = req.query;
      const percentileValue = parseInt(percentile) || 75; // Top 25% mais inativos
      const resultLimit = parseInt(limit) || 50;

      const result = await customerAnalyticsService.getInactivePatientsDynamic(percentileValue, resultLimit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Erro ao buscar pacientes inativos (dinâmico):', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar pacientes inativos',
        message: error.message,
      });
    }
  },

  /**
   * Retorna pacientes atrasados baseado em sua frequência histórica
   */
  async getPatientsOverdueForReturn(req, res) {
    try {
      const { multiplier, limit } = req.query;
      const multiplierValue = parseFloat(multiplier) || 2; // 2x o intervalo normal
      const resultLimit = parseInt(limit) || 50;

      const patients = await customerAnalyticsService.getPatientsOverdueForReturn(multiplierValue, resultLimit);

      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Erro ao buscar pacientes atrasados:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar pacientes atrasados',
        message: error.message,
      });
    }
  },

  /**
   * Retorna resumo de pacientes em risco de churn
   */
  async getChurnRiskSummary(req, res) {
    try {
      const summary = await customerAnalyticsService.getChurnRiskSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Erro ao buscar resumo de churn:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar resumo de churn',
        message: error.message,
      });
    }
  },

  // ==================== PHASE 3 & 4: MARKETING KPIs ====================

  /**
   * Retorna métricas de tempo de conversão de leads
   * GET /api/dashboard/conversion-time
   */
  async getConversionTime(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const metrics = await dashboardDBService.getConversionTimeMetrics(startDate, endDate);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Erro ao buscar tempo de conversão:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo de conversão',
        message: error.message,
      });
    }
  },

  /**
   * Retorna métricas de ROAS, CPL e CPA por fonte
   * GET /api/dashboard/marketing-roas
   * Query: data_inicio, data_fim, ad_spend_facebook, ad_spend_google, ad_spend_instagram
   */
  async getMarketingROAS(req, res) {
    try {
      const { data_inicio, data_fim, ad_spend_facebook, ad_spend_google, ad_spend_instagram } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      // Construir objeto de gastos com ads
      const adSpend = {
        facebook: parseFloat(ad_spend_facebook) || 0,
        google: parseFloat(ad_spend_google) || 0,
        instagram: parseFloat(ad_spend_instagram) || 0,
      };

      const metrics = await dashboardDBService.getMarketingROASMetrics(startDate, endDate, adSpend);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas ROAS:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas ROAS',
        message: error.message,
      });
    }
  },

  /**
   * Retorna funil de conversão avançado com drop-off
   * GET /api/dashboard/advanced-funnel
   */
  async getAdvancedFunnel(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const funnel = await dashboardDBService.getAdvancedFunnel(startDate, endDate);

      res.json({
        success: true,
        data: funnel,
      });
    } catch (error) {
      logger.error('Erro ao buscar funil avançado:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar funil avançado',
        message: error.message,
      });
    }
  },

  /**
   * Retorna atribuição de leads por campanha Bitrix
   * GET /api/dashboard/campaign-attribution
   */
  async getCampaignAttribution(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const attribution = await dashboardDBService.getCampaignAttribution(startDate, endDate);

      res.json({
        success: true,
        data: attribution,
      });
    } catch (error) {
      logger.error('Erro ao buscar atribuição por campanha:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar atribuição por campanha',
        message: error.message,
      });
    }
  },

  /**
   * Retorna métricas de Customer LTV e retenção
   * GET /api/dashboard/customer-ltv
   */
  async getCustomerLTV(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisYear.start;
      const endDate = data_fim || dateRanges.thisYear.end;
      const centrosCusto = centros_custo ? centros_custo.split(',').map(Number) : [];

      const metrics = await belleService.getCustomerLTVMetrics(startDate, endDate, centrosCusto);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas de LTV:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas de LTV',
        message: error.message,
      });
    }
  },

  /**
   * Retorna analytics de vouchers
   * GET /api/dashboard/voucher-analytics
   */
  async getVoucherAnalytics(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisYear.start;
      const endDate = data_fim || dateRanges.thisYear.end;

      const analytics = await belleService.getVoucherAnalytics(startDate, endDate);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Erro ao buscar analytics de vouchers:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar analytics de vouchers',
        message: error.message,
      });
    }
  },

  /**
   * Retorna métricas de recorrência de pacientes
   * GET /api/dashboard/recurrence-metrics
   */
  async getRecurrenceMetrics(req, res) {
    try {
      const { data_inicio, data_fim, min_interval } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisYear.start;
      const endDate = data_fim || dateRanges.thisYear.end;
      const minIntervalDays = parseInt(min_interval) || 30;

      const metrics = await belleService.getRecurrenceMetrics(startDate, endDate, minIntervalDays);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas de recorrência:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas de recorrência',
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
      // TUDO DO BANCO - sem chamadas a APIs externas (Bitrix24/Belle offline)
      // Buscar centros de custo e profissionais do banco de dados
      const [centrosCustoResult, profissionaisResult] = await Promise.all([
        dashboardDBService.getCentrosCustoFromDB().catch(() => []),
        dashboardDBService.getProfissionaisFromVendas(
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // ultimo ano
          new Date().toISOString().split('T')[0],
          50
        ).catch(() => []),
      ]);

      // Opções de origem do lead (estáticas - baseadas no campo UF_CRM_1692640693814)
      const origemLeadOptions = [
        { id: 'NAO_PREENCHIDO', name: 'Não preenchido' },
        { id: '5403', name: 'Iniciativa Interna' },
        { id: '5405', name: 'Iniciativa do paciente' },
      ];

      // Status de lead (estáticos - do Bitrix24)
      const leadStatuses = [
        { id: 'NEW', name: 'Novo' },
        { id: 'IN_PROCESS', name: 'Em atendimento' },
        { id: 'PROCESSED', name: 'Agendou' },
        { id: 'CONVERTED', name: 'Convertido' },
        { id: 'JUNK', name: 'Desqualificado' },
      ];

      // Fontes de lead (estáticas)
      const leadSources = [
        { id: 'CALL', name: 'Ligação' },
        { id: 'EMAIL', name: 'E-mail' },
        { id: 'WEB', name: 'Site' },
        { id: 'SOCIAL', name: 'Redes sociais' },
        { id: 'OTHER', name: 'Outros' },
      ];

      res.json({
        success: true,
        data: {
          leadStatuses,
          leadSources,
          origemLeadOptions,
          dealStages: [], // Não usado atualmente
          dealCategories: [], // Não usado atualmente
          centrosCusto: centrosCustoResult || [],
          profissionais: profissionaisResult.map(p => ({ nome: p.nome })) || [],
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

  // ==================== CACHE CLEAR ====================

  async clearCache(req, res) {
    try {
      // Clear Belle service cache
      belleService.clearCache();

      // Clear HTTP middleware cache
      const { clearCache } = await import('../utils/cache.js');
      clearCache();

      logger.info('[Dashboard] All caches cleared');

      res.json({
        success: true,
        message: 'All caches cleared successfully',
      });
    } catch (error) {
      logger.error('Erro ao limpar cache:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao limpar cache',
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

  /**
   * Executa backfill de dados históricos
   * POST /api/dashboard/backfill
   * Body: { data_inicio: 'yyyy-MM-dd', data_fim: 'yyyy-MM-dd', entities?: ['contas_receber', 'vendas'] }
   */
  async runBackfill(req, res) {
    try {
      const { data_inicio, data_fim, entities } = req.body;

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros data_inicio e data_fim são obrigatórios',
        });
      }

      logger.info(`[Backfill API] Iniciando backfill de ${data_inicio} a ${data_fim}`);

      const result = await syncService.runBackfill(data_inicio, data_fim, entities);

      res.json({
        success: true,
        message: 'Backfill concluído com sucesso',
        data: result,
      });
    } catch (error) {
      logger.error('Erro no backfill:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao executar backfill',
        message: error.message,
      });
    }
  },

  /**
   * Executa backfill do ano atual (atalho)
   * POST /api/dashboard/backfill/current-year
   */
  async runBackfillCurrentYear(req, res) {
    try {
      logger.info(`[Backfill API] Iniciando backfill do ano atual`);

      const result = await syncService.backfillCurrentYear();

      res.json({
        success: true,
        message: 'Backfill do ano atual concluído com sucesso',
        data: result,
      });
    } catch (error) {
      logger.error('Erro no backfill do ano atual:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao executar backfill do ano atual',
        message: error.message,
      });
    }
  },

  /**
   * Busca estatísticas de clientes recorrentes vs novos
   * GET /api/dashboard/return-customer-stats
   */
  async getReturnCustomerStats(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const stats = await dashboardDBService.getReturnCustomerStats(startDate, endDate);

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

  /**
   * Busca funil de conversão com comparativo do período anterior
   * GET /api/dashboard/funnel-comparison
   */
  async getFunnelComparison(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const comparison = await dashboardDBService.getFunnelComparison(startDate, endDate);

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      logger.error('Erro ao buscar comparativo de funil:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar comparativo de funil',
        message: error.message,
      });
    }
  },

  // ==================== NOVOS INDICADORES DA APRESENTAÇÃO ====================

  /**
   * Retorna Taxa de Retenção (90 dias) e Taxa de Resgate
   * GET /api/dashboard/retention-rescue
   */
  async getRetentionRescue(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getRetentionAndRescueRates(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar retenção/resgate:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de retenção/resgate',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Faturamento por Médico
   * GET /api/dashboard/faturamento-medico
   */
  async getFaturamentoMedico(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getFaturamentoPorMedico(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar faturamento por médico:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar faturamento por médico',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Faturamento por Serviço/Categoria
   * GET /api/dashboard/faturamento-servico
   */
  async getFaturamentoServico(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getFaturamentoPorServico(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar faturamento por serviço:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar faturamento por serviço',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Ticket Médio Novos vs Recorrentes
   * GET /api/dashboard/ticket-medio-tipo
   */
  async getTicketMedioTipo(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getTicketMedioNovosVsRecorrentes(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar ticket médio por tipo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar ticket médio por tipo',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Conversão por Canal (WhatsApp vs Ligação)
   * GET /api/dashboard/conversao-canal
   */
  async getConversaoCanal(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getConversaoPorCanal(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar conversão por canal:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar conversão por canal',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Taxa de No-Show
   * GET /api/dashboard/no-show
   */
  async getNoShow(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getTaxaNoShow(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar taxa de no-show:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar taxa de no-show',
        message: error.message,
      });
    }
  },

  /**
   * Retorna Taxa de Conversão de Propostas
   * GET /api/dashboard/conversao-propostas
   */
  async getConversaoPropostas(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await dashboardDBService.getTaxaConversaoPropostas(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar conversão de propostas:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar conversão de propostas',
        message: error.message,
      });
    }
  },

  /**
   * Retorna CAC por Canal
   * GET /api/dashboard/cac-canal
   */
  async getCACCanal(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      // TODO: Permitir passar investimentos via query params ou body
      const data = await dashboardDBService.getCACPorCanal(startDate, endDate);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar CAC por canal:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar CAC por canal',
        message: error.message,
      });
    }
  },

  // ==================== INDICADORES 8Ps (Metodologia Conrado Adolpho) ====================

  /**
   * Retorna indicadores 8Ps básicos
   * GET /api/dashboard/8ps
   */
  async get8Ps(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo, origem } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      const data = await indicadores8psService.calcularIndicadores8Ps(
        startDate,
        endDate,
        centrosCusto,
        origem || null
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar indicadores 8Ps:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar indicadores 8Ps',
        message: error.message,
      });
    }
  },

  /**
   * Retorna indicadores 8Ps avançados (inclui campanhas, gargalos, públicos 9)
   * GET /api/dashboard/8ps/avancado
   */
  async get8PsAvancado(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo, origem } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      const data = await indicadores8psService.calcularIndicadores8PsAvancado(
        startDate,
        endDate,
        centrosCusto,
        origem || null
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar indicadores 8Ps avançados:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar indicadores 8Ps avançados',
        message: error.message,
      });
    }
  },

  /**
   * Retorna análise de performance por campanha
   * GET /api/dashboard/8ps/campanhas
   */
  async get8PsCampanhas(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await indicadores8psService.calcularIndicadoresPorCampanha(
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar indicadores por campanha:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar indicadores por campanha',
        message: error.message,
      });
    }
  },

  /**
   * Retorna análise de gargalos no funil (motivos de desqualificação)
   * GET /api/dashboard/8ps/gargalos
   */
  async get8PsGargalos(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await indicadores8psService.analisarGargalosFunil(
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao analisar gargalos do funil:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao analisar gargalos do funil',
        message: error.message,
      });
    }
  },

  /**
   * Retorna os 9 públicos da metodologia 8Ps
   * GET /api/dashboard/8ps/publicos
   */
  async get8PsPublicos(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      // Buscar dados do Bitrix24 e Belle para montar os públicos
      const bitrixData = await dashboardDBService.getLeadsAnalyticsFromDB(startDate, endDate);
      const belleData = await dashboardDBService.getNewPatientRevenuePercentage(startDate, endDate);

      const data = await indicadores8psService.montarPublicos9Avancado(
        startDate,
        endDate,
        {
          totalLeads: bitrixData.total || 0,
          leadsQualificados: bitrixData.byStatus?.filter(s => s.semantic === 'success')?.reduce((sum, s) => sum + s.count, 0) || 0,
          conversas: bitrixData.byStatus?.filter(s => s.semantic === 'process')?.reduce((sum, s) => sum + s.count, 0) || 0,
          desqualificados: bitrixData.byStatus?.filter(s => s.semantic === 'failure')?.reduce((sum, s) => sum + s.count, 0) || 0,
          avgConversionDays: bitrixData.metrics?.avgConversionDays || 0,
          avgInProgressDays: bitrixData.metrics?.avgInProgressDays || 0,
        },
        {
          novosClientes: belleData.newPatientCount || 0,
          clientesRecorrentes: belleData.returningPatientCount || 0,
          tempoVidaMedio: 365, // TODO: calcular do banco
        }
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar públicos 8Ps:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar públicos 8Ps',
        message: error.message,
      });
    }
  },

  // ==================== MÉTRICAS AVANÇADAS DE PACIENTES ====================

  /**
   * Retorna métricas avançadas de pacientes (enriquecimento Belle Software)
   * GET /api/dashboard/pacientes/avancado
   */
  async getPacientesAvancado(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',').map(Number) : [];

      const data = await belleService.getMetricasAvancadasPacientes(
        startDate,
        endDate,
        centrosCusto
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas avançadas de pacientes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas avançadas de pacientes',
        message: error.message,
      });
    }
  },

  /**
   * Retorna atividade de clientes (ativos vs inativos)
   * GET /api/dashboard/pacientes/atividade
   */
  async getPacientesAtividade(req, res) {
    try {
      const { data_inicio, data_fim } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;

      const data = await belleService.getAtividadeClientesConsolidado(
        startDate,
        endDate
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar atividade de pacientes:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar atividade de pacientes',
        message: error.message,
      });
    }
  },

  // ==================== ALERTAS 8Ps ====================

  /**
   * Retorna alertas automáticos baseados nas metas 8Ps
   * GET /api/dashboard/8ps/alertas
   */
  async get8PsAlertas(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      const data = await alertas8psService.gerarAlertas8Ps(
        startDate,
        endDate,
        centrosCusto
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao gerar alertas 8Ps:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao gerar alertas 8Ps',
        message: error.message,
      });
    }
  },

  /**
   * Retorna resumo de saúde dos indicadores 8Ps (semáforo)
   * GET /api/dashboard/8ps/saude
   */
  async get8PsSaude(req, res) {
    try {
      const { data_inicio, data_fim, centros_custo } = req.query;
      const dateRanges = getDateRanges();

      const startDate = data_inicio || dateRanges.thisMonth.start;
      const endDate = data_fim || dateRanges.thisMonth.end;
      const centrosCusto = centros_custo ? centros_custo.split(',') : [];

      const data = await alertas8psService.getSaude8Ps(
        startDate,
        endDate,
        centrosCusto
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar saúde 8Ps:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar saúde 8Ps',
        message: error.message,
      });
    }
  },

  /**
   * Retorna as metas 8Ps configuradas
   * GET /api/dashboard/8ps/metas
   */
  async get8PsMetas(req, res) {
    try {
      const data = alertas8psService.getMetas8Ps();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Erro ao buscar metas 8Ps:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar metas 8Ps',
        message: error.message,
      });
    }
  },
};

export default dashboardController;
