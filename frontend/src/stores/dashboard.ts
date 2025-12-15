import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { dashboardCache } from '@/services/cache'
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
} from '@/types'

export type DashboardData = {
  resumo: ResumoData | null
  faturamento: FaturamentoData | null
  marketing: MarketingData | null
  comercial: ComercialData | null
  atendimento: AtendimentoData | null
  metas: MetasData | null
  pacientes: PacientesData | null
}

export type LoadingState = {
  resumo: boolean
  faturamento: boolean
  marketing: boolean
  comercial: boolean
  atendimento: boolean
  metas: boolean
  pacientes: boolean
}

export type RevalidatingState = {
  resumo: boolean
  faturamento: boolean
  marketing: boolean
  comercial: boolean
  atendimento: boolean
  metas: boolean
  pacientes: boolean
}

const initialLoadingState: LoadingState = {
  resumo: false,
  faturamento: false,
  marketing: false,
  comercial: false,
  atendimento: false,
  metas: false,
  pacientes: false,
}

const initialRevalidatingState: RevalidatingState = {
  resumo: false,
  faturamento: false,
  marketing: false,
  comercial: false,
  atendimento: false,
  metas: false,
  pacientes: false,
}

function getInitialFilters(): FilterState {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return {
    dataInicio: startOfMonth.toISOString().split('T')[0],
    dataFim: endOfMonth.toISOString().split('T')[0],
    centrosCusto: [],
  }
}

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const loadingStates = ref<LoadingState>({ ...initialLoadingState })
  const revalidatingStates = ref<RevalidatingState>({ ...initialRevalidatingState })
  const error = ref<string | null>(null)
  const data = ref<DashboardData>({
    resumo: null,
    faturamento: null,
    marketing: null,
    comercial: null,
    atendimento: null,
    metas: null,
    pacientes: null,
  })
  const filterOptions = ref<FilterOptions | null>(null)
  const filters = ref<FilterState>(getInitialFilters())
  const prefetched = ref(false)

  // Getters
  const loading = computed(() => Object.values(loadingStates.value).some(Boolean))
  const isRevalidating = computed(() => Object.values(revalidatingStates.value).some(Boolean))

  // Actions
  async function fetchFilterOptions() {
    try {
      const options = await api.getFilterOptions()
      filterOptions.value = options
    } catch (err) {
      console.error('Erro ao buscar opções de filtro:', err)
    }
  }

  async function fetchWithSWR<T>(
    key: keyof DashboardData,
    fetchFn: () => Promise<T>,
    currentFilters: Partial<FilterState>
  ): Promise<T | null> {
    // Check cache first
    const cached = dashboardCache.getStale<T>(key, currentFilters)

    if (cached) {
      // Show cached data immediately
      data.value[key] = cached.data as DashboardData[keyof DashboardData]

      if (!cached.isStale) {
        // Fresh cache, no need to refetch
        return cached.data
      }

      // Stale cache - show it but revalidate in background
      revalidatingStates.value[key] = true
    } else {
      // No cache - show loading
      loadingStates.value[key] = true
    }

    try {
      const freshData = await fetchFn()
      dashboardCache.set(key, freshData, currentFilters)
      data.value[key] = freshData as DashboardData[keyof DashboardData]
      error.value = null
      return freshData
    } catch (err) {
      // Only show error if we don't have cached data
      if (!cached) {
        error.value = `Erro ao carregar dados de ${key}`
      }
      console.error(`Erro ao carregar ${key}:`, err)
      return cached?.data || null
    } finally {
      loadingStates.value[key] = false
      revalidatingStates.value[key] = false
    }
  }

  async function fetchResumo() {
    return fetchWithSWR('resumo', () => api.getResumo(filters.value), filters.value)
  }

  async function fetchFaturamento() {
    return fetchWithSWR('faturamento', () => api.getFaturamento(filters.value), filters.value)
  }

  async function fetchMarketing() {
    return fetchWithSWR('marketing', () => api.getMarketing(filters.value), filters.value)
  }

  async function fetchComercial() {
    return fetchWithSWR('comercial', () => api.getComercial(filters.value), filters.value)
  }

  async function fetchAtendimento() {
    return fetchWithSWR('atendimento', () => api.getAtendimento(filters.value), filters.value)
  }

  async function fetchMetas() {
    return fetchWithSWR('metas', () => api.getMetas(filters.value), filters.value)
  }

  async function fetchPacientes() {
    return fetchWithSWR('pacientes', () => api.getPacientes(filters.value), filters.value)
  }

  async function prefetchAll() {
    console.log('[Dashboard] Prefetching all data in parallel...')

    await Promise.allSettled([
      fetchWithSWR('resumo', () => api.getResumo(filters.value), filters.value),
      fetchWithSWR('faturamento', () => api.getFaturamento(filters.value), filters.value),
      fetchWithSWR('marketing', () => api.getMarketing(filters.value), filters.value),
      fetchWithSWR('comercial', () => api.getComercial(filters.value), filters.value),
      fetchWithSWR('atendimento', () => api.getAtendimento(filters.value), filters.value),
      fetchWithSWR('metas', () => api.getMetas(filters.value), filters.value),
      fetchWithSWR('pacientes', () => api.getPacientes(filters.value), filters.value),
    ])

    console.log('[Dashboard] Prefetch complete')
  }

  function setFilters(newFilters: FilterState) {
    filters.value = newFilters
  }

  async function init() {
    if (!prefetched.value) {
      prefetched.value = true
      await fetchFilterOptions()
      await prefetchAll()
    }
  }

  async function refetch() {
    await prefetchAll()
  }

  return {
    // State
    data,
    loadingStates,
    revalidatingStates,
    error,
    filters,
    filterOptions,
    // Getters
    loading,
    isRevalidating,
    // Actions
    setFilters,
    fetchFilterOptions,
    fetchResumo,
    fetchFaturamento,
    fetchMarketing,
    fetchComercial,
    fetchAtendimento,
    fetchMetas,
    fetchPacientes,
    prefetchAll,
    init,
    refetch,
  }
})
