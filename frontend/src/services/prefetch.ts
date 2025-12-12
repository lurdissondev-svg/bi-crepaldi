import api from './api';

// Cache para evitar múltiplos prefetch da mesma rota
const prefetchedRoutes = new Set<string>();
const prefetchingRoutes = new Set<string>();

// Mapeamento de rotas para funções de fetch
const routeFetchMap: Record<string, () => Promise<unknown>> = {
  '/': () => api.getResumo(getDefaultFilters()),
  '/faturamento': () => api.getFaturamento(getDefaultFilters()),
  '/marketing': () => api.getMarketing(getDefaultFilters()),
  '/comercial': () => api.getComercial(getDefaultFilters()),
  '/atendimento': () => api.getAtendimento(getDefaultFilters()),
  '/metas': () => api.getMetas(getDefaultFilters()),
  '/pacientes': () => api.getPacientes(getDefaultFilters()),
};

function getDefaultFilters() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    dataInicio: startOfMonth.toISOString().split('T')[0],
    dataFim: endOfMonth.toISOString().split('T')[0],
    centrosCusto: [],
  };
}

export async function prefetchRoute(path: string): Promise<void> {
  // Não prefetch se já foi feito ou está em andamento
  if (prefetchedRoutes.has(path) || prefetchingRoutes.has(path)) {
    return;
  }

  const fetchFn = routeFetchMap[path];
  if (!fetchFn) {
    return;
  }

  prefetchingRoutes.add(path);

  try {
    console.log(`[Prefetch] Carregando dados para ${path}...`);
    await fetchFn();
    prefetchedRoutes.add(path);
    console.log(`[Prefetch] Dados de ${path} carregados com sucesso`);
  } catch (error) {
    console.warn(`[Prefetch] Erro ao carregar ${path}:`, error);
  } finally {
    prefetchingRoutes.delete(path);
  }
}

// Limpa o cache de prefetch após 4 minutos (antes do cache do backend expirar)
setInterval(() => {
  prefetchedRoutes.clear();
}, 4 * 60 * 1000);

export function isPrefetched(path: string): boolean {
  return prefetchedRoutes.has(path);
}

export function isPrefetching(path: string): boolean {
  return prefetchingRoutes.has(path);
}
