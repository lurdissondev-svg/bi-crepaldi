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
  private lastKnownSyncAt: string | null = null;
  private syncPollingInterval: ReturnType<typeof setInterval> | null = null;
  private syncListeners: Set<() => void> = new Set();

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

  // ==================== SYNC-AWARE CACHE ====================

  /**
   * Start polling for sync status changes
   * When a new sync is detected, all caches are invalidated
   */
  startSyncPolling(apiBaseUrl: string = '/api'): void {
    if (this.syncPollingInterval) return;

    const checkSync = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/dashboard/sync-status`);
        if (!response.ok) return;

        const data = await response.json();
        const newSyncAt = data.lastSyncAt;

        if (newSyncAt && this.lastKnownSyncAt && newSyncAt !== this.lastKnownSyncAt) {
          // New sync detected - invalidate all cache
          console.log('[Cache] New sync detected, invalidating cache');
          this.clear();
          this.notifySyncListeners();
        }

        this.lastKnownSyncAt = newSyncAt;
      } catch (error) {
        // Ignore errors - sync status endpoint may not be available
      }
    };

    // Initial check
    checkSync();

    // Poll every 30 seconds
    this.syncPollingInterval = setInterval(checkSync, 30 * 1000);
  }

  /**
   * Stop polling for sync status
   */
  stopSyncPolling(): void {
    if (this.syncPollingInterval) {
      clearInterval(this.syncPollingInterval);
      this.syncPollingInterval = null;
    }
  }

  /**
   * Subscribe to sync invalidation events
   * Returns an unsubscribe function
   */
  onSyncInvalidate(callback: () => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify all sync listeners
   */
  private notifySyncListeners(): void {
    this.syncListeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[Cache] Error in sync listener:', error);
      }
    });
  }

  /**
   * Get the last known sync timestamp
   */
  getLastSyncAt(): string | null {
    return this.lastKnownSyncAt;
  }

  /**
   * Manually update the last known sync timestamp
   * (useful when sync status is received from another source)
   */
  updateSyncTimestamp(syncAt: string): void {
    if (syncAt && this.lastKnownSyncAt && syncAt !== this.lastKnownSyncAt) {
      // New sync detected - invalidate all cache
      console.log('[Cache] Sync timestamp updated, invalidating cache');
      this.clear();
      this.notifySyncListeners();
    }
    this.lastKnownSyncAt = syncAt;
  }
}

export const dashboardCache = new DashboardCache();
export default dashboardCache;
