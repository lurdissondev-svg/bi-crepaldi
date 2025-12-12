import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type {
  FilterState,
  ResumoData,
  FaturamentoData,
  MarketingData,
  ComercialData,
  AtendimentoData,
  MetasData,
  PacientesData,
  FilterOptions,
} from '../types';

type DashboardData = {
  resumo: ResumoData | null;
  faturamento: FaturamentoData | null;
  marketing: MarketingData | null;
  comercial: ComercialData | null;
  atendimento: AtendimentoData | null;
  metas: MetasData | null;
  pacientes: PacientesData | null;
};

export function useDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    resumo: null,
    faturamento: null,
    marketing: null,
    comercial: null,
    atendimento: null,
    metas: null,
    pacientes: null,
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  const [filters, setFilters] = useState<FilterState>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      dataInicio: startOfMonth.toISOString().split('T')[0],
      dataFim: endOfMonth.toISOString().split('T')[0],
      centrosCusto: [],
    };
  });

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await api.getFilterOptions();
      setFilterOptions(options);
    } catch (err) {
      console.error('Erro ao buscar opções de filtro:', err);
    }
  }, []);

  const fetchResumo = useCallback(async () => {
    setLoading(true);
    try {
      const resumo = await api.getResumo(filters);
      setData((prev) => ({ ...prev, resumo }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados do resumo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchFaturamento = useCallback(async () => {
    setLoading(true);
    try {
      const faturamento = await api.getFaturamento(filters);
      setData((prev) => ({ ...prev, faturamento }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados de faturamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchMarketing = useCallback(async () => {
    setLoading(true);
    try {
      const marketing = await api.getMarketing(filters);
      setData((prev) => ({ ...prev, marketing }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados de marketing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchComercial = useCallback(async () => {
    setLoading(true);
    try {
      const comercial = await api.getComercial(filters);
      setData((prev) => ({ ...prev, comercial }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados comerciais');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchAtendimento = useCallback(async () => {
    setLoading(true);
    try {
      const atendimento = await api.getAtendimento(filters);
      setData((prev) => ({ ...prev, atendimento }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados de atendimento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchMetas = useCallback(async () => {
    setLoading(true);
    try {
      const metas = await api.getMetas(filters);
      setData((prev) => ({ ...prev, metas }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados de metas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPacientes = useCallback(async () => {
    setLoading(true);
    try {
      const pacientes = await api.getPacientes(filters);
      setData((prev) => ({ ...prev, pacientes }));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar dados de pacientes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  return {
    data,
    loading,
    error,
    filters,
    setFilters,
    filterOptions,
    fetchResumo,
    fetchFaturamento,
    fetchMarketing,
    fetchComercial,
    fetchAtendimento,
    fetchMetas,
    fetchPacientes,
  };
}
