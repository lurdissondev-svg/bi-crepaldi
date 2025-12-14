import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { dashboardCache } from '../services/cache';
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

type LoadingState = {
  resumo: boolean;
  faturamento: boolean;
  marketing: boolean;
  comercial: boolean;
  atendimento: boolean;
  metas: boolean;
  pacientes: boolean;
};

type RevalidatingState = {
  resumo: boolean;
  faturamento: boolean;
  marketing: boolean;
  comercial: boolean;
  atendimento: boolean;
  metas: boolean;
  pacientes: boolean;
};

const initialLoadingState: LoadingState = {
  resumo: false,
  faturamento: false,
  marketing: false,
  comercial: false,
  atendimento: false,
  metas: false,
  pacientes: false,
};

const initialRevalidatingState: RevalidatingState = {
  resumo: false,
  faturamento: false,
  marketing: false,
  comercial: false,
  atendimento: false,
  metas: false,
  pacientes: false,
};

export function useDashboard() {
  const [loadingStates, setLoadingStates] = useState<LoadingState>(initialLoadingState);
  const [revalidatingStates, setRevalidatingStates] = useState<RevalidatingState>(initialRevalidatingState);
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
  const prefetchedRef = useRef(false);

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

  // Global loading (any tab is loading)
  const loading = Object.values(loadingStates).some(Boolean);

  // Check if any tab is revalidating (has stale data showing)
  const isRevalidating = Object.values(revalidatingStates).some(Boolean);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await api.getFilterOptions();
      setFilterOptions(options);
    } catch (err) {
      console.error('Erro ao buscar opções de filtro:', err);
    }
  }, []);

  /**
   * Generic fetch with stale-while-revalidate pattern
   */
  const fetchWithSWR = useCallback(async <T>(
    key: keyof DashboardData,
    fetchFn: () => Promise<T>,
    currentFilters: Partial<FilterState>
  ): Promise<T | null> => {
    // Check cache first
    const cached = dashboardCache.getStale<T>(key, currentFilters);

    if (cached) {
      // Show cached data immediately
      setData(prev => ({ ...prev, [key]: cached.data }));

      if (!cached.isStale) {
        // Fresh cache, no need to refetch
        return cached.data;
      }

      // Stale cache - show it but revalidate in background
      setRevalidatingStates(prev => ({ ...prev, [key]: true }));
    } else {
      // No cache - show loading
      setLoadingStates(prev => ({ ...prev, [key]: true }));
    }

    try {
      const freshData = await fetchFn();
      dashboardCache.set(key, freshData, currentFilters);
      setData(prev => ({ ...prev, [key]: freshData }));
      setError(null);
      return freshData;
    } catch (err) {
      // Only show error if we don't have cached data
      if (!cached) {
        setError(`Erro ao carregar dados de ${key}`);
      }
      console.error(`Erro ao carregar ${key}:`, err);
      return cached?.data || null;
    } finally {
      setLoadingStates(prev => ({ ...prev, [key]: false }));
      setRevalidatingStates(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const fetchResumo = useCallback(async () => {
    return fetchWithSWR('resumo', () => api.getResumo(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchFaturamento = useCallback(async () => {
    return fetchWithSWR('faturamento', () => api.getFaturamento(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchMarketing = useCallback(async () => {
    return fetchWithSWR('marketing', () => api.getMarketing(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchComercial = useCallback(async () => {
    return fetchWithSWR('comercial', () => api.getComercial(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchAtendimento = useCallback(async () => {
    return fetchWithSWR('atendimento', () => api.getAtendimento(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchMetas = useCallback(async () => {
    return fetchWithSWR('metas', () => api.getMetas(filters), filters);
  }, [filters, fetchWithSWR]);

  const fetchPacientes = useCallback(async () => {
    return fetchWithSWR('pacientes', () => api.getPacientes(filters), filters);
  }, [filters, fetchWithSWR]);

  /**
   * Prefetch all dashboard data in parallel
   * Called on initial load and when filters change
   */
  const prefetchAll = useCallback(async () => {
    console.log('[Dashboard] Prefetching all data in parallel...');

    await Promise.allSettled([
      fetchWithSWR('resumo', () => api.getResumo(filters), filters),
      fetchWithSWR('faturamento', () => api.getFaturamento(filters), filters),
      fetchWithSWR('marketing', () => api.getMarketing(filters), filters),
      fetchWithSWR('comercial', () => api.getComercial(filters), filters),
      fetchWithSWR('atendimento', () => api.getAtendimento(filters), filters),
      fetchWithSWR('metas', () => api.getMetas(filters), filters),
      fetchWithSWR('pacientes', () => api.getPacientes(filters), filters),
    ]);

    console.log('[Dashboard] Prefetch complete');
  }, [filters, fetchWithSWR]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Prefetch all data on mount and when filters change
  useEffect(() => {
    // Skip first render if we want to delay prefetch
    if (!prefetchedRef.current) {
      prefetchedRef.current = true;
      prefetchAll();
    }
  }, [prefetchAll]);

  // Refetch when filters change (after initial load)
  useEffect(() => {
    if (prefetchedRef.current) {
      prefetchAll();
    }
  }, [filters, prefetchAll]);

  return {
    data,
    loading,
    loadingStates,
    isRevalidating,
    revalidatingStates,
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
    prefetchAll,
  };
}
