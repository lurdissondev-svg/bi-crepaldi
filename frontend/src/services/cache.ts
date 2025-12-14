import type { FilterState } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  filterHash: string;
}

type CacheKey = 'resumo' | 'faturamento' | 'marketing' | 'comercial' | 'atendimento' | 'metas' | 'pacientes';

class DashboardCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private TTL = 5 * 60 * 1000; // 5 minutes - match backend cache

  /**
   * Creates a hash from filter state for cache key
   */
  getFilterHash(filters: Partial<FilterState>): string {
    const normalized = {
      dataInicio: filters.dataInicio || '',
      dataFim: filters.dataFim || '',
      centrosCusto: [...(filters.centrosCusto || [])].sort(),
      profissional: filters.profissional || '',
      confirmado: filters.confirmado || '',
      tipo: filters.tipo || '',
      fonte: filters.fonte || '',
      origem: filters.origem || '',
      faseLead: filters.faseLead || '',
    };
    return JSON.stringify(normalized);
  }

  /**
   * Get cached data if valid
   */
  get<T>(key: CacheKey, filters: Partial<FilterState>): T | null {
    const cacheKey = `${key}:${this.getFilterHash(filters)}`;
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Get stale data (even if expired) for stale-while-revalidate
   */
  getStale<T>(key: CacheKey, filters: Partial<FilterState>): { data: T; isStale: boolean } | null {
    const cacheKey = `${key}:${this.getFilterHash(filters)}`;
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) return null;

    const isStale = Date.now() - entry.timestamp > this.TTL;
    return { data: entry.data, isStale };
  }

  /**
   * Set cache data
   */
  set<T>(key: CacheKey, data: T, filters: Partial<FilterState>): void {
    const cacheKey = `${key}:${this.getFilterHash(filters)}`;
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      filterHash: this.getFilterHash(filters),
    });
  }

  /**
   * Invalidate all cache for specific filters
   */
  invalidateFilters(filters: Partial<FilterState>): void {
    const filterHash = this.getFilterHash(filters);
    for (const [key] of this.cache) {
      if (key.endsWith(`:${filterHash}`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache age in seconds
   */
  getAge(key: CacheKey, filters: Partial<FilterState>): number | null {
    const cacheKey = `${key}:${this.getFilterHash(filters)}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    return Math.floor((Date.now() - entry.timestamp) / 1000);
  }
}

export const dashboardCache = new DashboardCache();
export default dashboardCache;
