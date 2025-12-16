import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  ResumoData,
  FaturamentoData,
  MarketingData,
  ComercialData,
  AtendimentoData,
  MetasData,
  PacientesData,
  FilterOptions,
  FilterState,
  MetaAdsConfig,
  MetaAdsValidationResult,
  ConversionMetrics,
  ConversionFunnelStage,
  ReturningCustomerStats,
  RFMSegment,
  TopCustomerByLTV,
  InactivePatient,
  InactivePatientsDynamicResponse,
  PatientsOverdueResponse,
  ChurnRiskSummaryResponse,
  MarketingROIData,
  SpendTrendData,
  MetaAdsSummary,
} from '../types';
import type {
  User,
  UserListItem,
  LoginCredentials,
  LoginResponse,
  CreateUserDto,
  UpdateUserDto,
  Role,
  PageDefinition,
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60s - API Belle pode demorar
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - Add Bearer token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle 401 and refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not a refresh request and not already retrying
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/login') &&
          !originalRequest.url?.includes('/auth/refresh')
        ) {
          if (this.isRefreshing) {
            // Queue the request while refreshing
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => {
                originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error('No refresh token');
            }

            const response = await this.client.post<ApiResponse<{ accessToken: string }>>(
              '/auth/refresh',
              { refreshToken }
            );

            const newAccessToken = response.data.data.accessToken;
            localStorage.setItem('accessToken', newAccessToken);

            // Process queued requests
            this.failedQueue.forEach((prom) => prom.resolve(null));
            this.failedQueue = [];

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed - clear tokens and redirect to login
            this.failedQueue.forEach((prom) => prom.reject(refreshError));
            this.failedQueue = [];
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private buildParams(filters: Partial<FilterState>) {
    const params: Record<string, string> = {};

    if (filters.dataInicio) params.data_inicio = filters.dataInicio;
    if (filters.dataFim) params.data_fim = filters.dataFim;
    if (filters.centrosCusto?.length) params.centros_custo = filters.centrosCusto.join(',');
    if (filters.profissional) params.profissional = filters.profissional;
    if (filters.confirmado) params.confirmado = filters.confirmado;
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.fonte) params.fonte = filters.fonte;
    if (filters.origem) params.origem = filters.origem;
    if (filters.faseLead) params.fase_lead = filters.faseLead;

    return params;
  }

  async getResumo(filters: Partial<FilterState> = {}): Promise<ResumoData> {
    const response = await this.client.get<ApiResponse<ResumoData>>(
      '/dashboard/resumo',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getFaturamento(filters: Partial<FilterState> = {}): Promise<FaturamentoData> {
    const response = await this.client.get<ApiResponse<FaturamentoData>>(
      '/dashboard/faturamento',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getMarketing(filters: Partial<FilterState> = {}): Promise<MarketingData> {
    const response = await this.client.get<ApiResponse<MarketingData>>(
      '/dashboard/marketing',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getComercial(filters: Partial<FilterState> = {}): Promise<ComercialData> {
    const response = await this.client.get<ApiResponse<ComercialData>>(
      '/dashboard/comercial',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getAtendimento(filters: Partial<FilterState> = {}): Promise<AtendimentoData> {
    const response = await this.client.get<ApiResponse<AtendimentoData>>(
      '/dashboard/atendimento',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getMetas(filters: Partial<FilterState> = {}): Promise<MetasData> {
    const response = await this.client.get<ApiResponse<MetasData>>(
      '/dashboard/metas',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getPacientes(filters: Partial<FilterState> = {}): Promise<PacientesData> {
    const response = await this.client.get<ApiResponse<PacientesData>>(
      '/dashboard/pacientes',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const response = await this.client.get<ApiResponse<FilterOptions>>('/dashboard/filtros');
    return response.data.data;
  }

  // Customer Analytics (Phase 2)
  async getConversionMetrics(filters: Partial<FilterState> = {}): Promise<ConversionMetrics> {
    const response = await this.client.get<ApiResponse<ConversionMetrics>>(
      '/dashboard/conversion-metrics',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getConversionFunnel(filters: Partial<FilterState> = {}): Promise<ConversionFunnelStage[]> {
    const response = await this.client.get<ApiResponse<ConversionFunnelStage[]>>(
      '/dashboard/conversion-funnel',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getReturningCustomerStats(filters: Partial<FilterState> = {}): Promise<ReturningCustomerStats> {
    const response = await this.client.get<ApiResponse<ReturningCustomerStats>>(
      '/dashboard/returning-customers',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getRFMSegmentation(): Promise<RFMSegment[]> {
    const response = await this.client.get<ApiResponse<RFMSegment[]>>(
      '/dashboard/rfm-segmentation'
    );
    return response.data.data;
  }

  async getTopCustomersByLTV(limit: number = 20): Promise<TopCustomerByLTV[]> {
    const response = await this.client.get<ApiResponse<TopCustomerByLTV[]>>(
      '/dashboard/top-customers-ltv',
      { params: { limit } }
    );
    return response.data.data;
  }

  async getInactivePatients(days: number = 120, limit: number = 50): Promise<InactivePatient[]> {
    const response = await this.client.get<ApiResponse<InactivePatient[]>>(
      '/dashboard/inactive-patients',
      { params: { days, limit } }
    );
    return response.data.data;
  }

  /**
   * Busca pacientes inativos usando threshold dinâmico baseado em percentil.
   * Funciona mesmo com períodos curtos de dados (adapta automaticamente).
   * @param percentile - Percentil para calcular o threshold (ex: 75 = top 25% mais inativos)
   * @param limit - Limite de resultados
   */
  async getInactivePatientsDynamic(percentile: number = 75, limit: number = 50): Promise<InactivePatientsDynamicResponse> {
    const response = await this.client.get<ApiResponse<InactivePatientsDynamicResponse>>(
      '/dashboard/inactive-patients-dynamic',
      { params: { percentile, limit } }
    );
    return response.data.data;
  }

  /**
   * Busca pacientes com atraso baseado na frequência histórica de visitas.
   * Identifica quem está "atrasado" em relação ao seu padrão normal.
   * @param multiplier - Multiplicador do intervalo médio (ex: 2 = dobro do tempo normal)
   * @param limit - Limite de resultados
   */
  async getPatientsOverdue(multiplier: number = 2, limit: number = 50): Promise<PatientsOverdueResponse> {
    const response = await this.client.get<ApiResponse<PatientsOverdueResponse>>(
      '/dashboard/patients-overdue',
      { params: { multiplier, limit } }
    );
    return response.data.data;
  }

  /**
   * Retorna resumo de risco de churn agrupado por nível.
   * Útil para KPIs de retenção.
   */
  async getChurnRiskSummary(): Promise<ChurnRiskSummaryResponse> {
    const response = await this.client.get<ApiResponse<ChurnRiskSummaryResponse>>(
      '/dashboard/churn-risk-summary'
    );
    return response.data.data;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getDetailedHealth(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    integrations: {
      bitrix24: { status: string; message: string };
      belle: { status: string; message: string };
      metaAds: { status: string; message: string };
    };
  }> {
    const response = await this.client.get('/health/detailed');
    return response.data;
  }

  // Meta Ads Configuration
  async getMetaAdsConfig(): Promise<MetaAdsConfig | null> {
    try {
      const response = await this.client.get<ApiResponse<MetaAdsConfig>>('/meta/config');
      return response.data.data;
    } catch {
      return null;
    }
  }

  async saveMetaAdsConfig(config: Partial<MetaAdsConfig>): Promise<MetaAdsConfig> {
    const response = await this.client.post<ApiResponse<MetaAdsConfig>>('/meta/config', config);
    return response.data.data;
  }

  async validateMetaAdsConfig(config: {
    appId: string;
    appSecret: string;
    accessToken: string;
    adAccountId: string;
  }): Promise<MetaAdsValidationResult> {
    const response = await this.client.post<ApiResponse<MetaAdsValidationResult>>(
      '/meta/validate',
      config
    );
    return response.data.data;
  }

  async getMetaAdsInsights(filters: Partial<FilterState> = {}): Promise<Record<string, unknown>> {
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(
      '/meta/insights',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getMetaAdsSummary(filters: Partial<FilterState> = {}): Promise<MetaAdsSummary> {
    const response = await this.client.get<ApiResponse<MetaAdsSummary>>(
      '/meta/summary',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getMarketingROI(filters: Partial<FilterState> = {}): Promise<MarketingROIData> {
    const response = await this.client.get<ApiResponse<MarketingROIData>>(
      '/meta/roi',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async getSpendTrend(filters: Partial<FilterState> = {}): Promise<SpendTrendData[]> {
    const response = await this.client.get<ApiResponse<SpendTrendData[]>>(
      '/meta/spend-trend',
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  async syncMetaAdsSpend(filters: Partial<FilterState> = {}): Promise<{ syncedCount: number; totalInsights: number }> {
    const response = await this.client.post<ApiResponse<{ syncedCount: number; totalInsights: number }>>(
      '/meta/sync-spend',
      null,
      { params: this.buildParams(filters) }
    );
    return response.data.data;
  }

  // Sync Status
  async getSyncStatus(): Promise<{
    isRunning: boolean;
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    lastSyncStatus: 'success' | 'partial' | 'error' | null;
    intervalMinutes: number;
  }> {
    const response = await this.client.get<ApiResponse<{
      isRunning: boolean;
      lastSyncAt: string | null;
      nextSyncAt: string | null;
      lastSyncStatus: 'success' | 'partial' | 'error' | null;
      intervalMinutes: number;
    }>>('/dashboard/sync-status');
    return response.data.data;
  }

  // ===============================
  // Authentication
  // ===============================

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.client.post<ApiResponse<LoginResponse>>(
      '/auth/login',
      credentials
    );
    return response.data.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.client.post('/auth/logout', { refreshToken });
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await this.client.post<ApiResponse<{ accessToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  // ===============================
  // Users Management
  // ===============================

  async getUsers(): Promise<UserListItem[]> {
    const response = await this.client.get<ApiResponse<UserListItem[]>>('/users');
    return response.data.data;
  }

  async getUser(id: number): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  }

  async createUser(user: CreateUserDto): Promise<User> {
    const response = await this.client.post<ApiResponse<User>>('/users', user);
    return response.data.data;
  }

  async updateUser(id: number, user: UpdateUserDto): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>(`/users/${id}`, user);
    return response.data.data;
  }

  async deleteUser(id: number): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  // ===============================
  // Roles Management
  // ===============================

  async getRoles(): Promise<Role[]> {
    const response = await this.client.get<ApiResponse<Role[]>>('/roles');
    return response.data.data;
  }

  async getRole(id: number): Promise<Role> {
    const response = await this.client.get<ApiResponse<Role>>(`/roles/${id}`);
    return response.data.data;
  }

  async getPages(): Promise<PageDefinition[]> {
    const response = await this.client.get<ApiResponse<PageDefinition[]>>('/roles/pages');
    return response.data.data;
  }

  async createRole(name: string, description: string): Promise<Role> {
    const response = await this.client.post<ApiResponse<Role>>('/roles', {
      name,
      description,
    });
    return response.data.data;
  }

  async updateRole(id: number, data: { name?: string; description?: string }): Promise<Role> {
    const response = await this.client.put<ApiResponse<Role>>(`/roles/${id}`, data);
    return response.data.data;
  }

  async updateRolePermissions(
    id: number,
    permissions: Array<{ pageSlug: string; canView: boolean }>
  ): Promise<Role> {
    const response = await this.client.put<ApiResponse<Role>>(
      `/roles/${id}/permissions`,
      { permissions }
    );
    return response.data.data;
  }

  async deleteRole(id: number): Promise<void> {
    await this.client.delete(`/roles/${id}`);
  }

  // ===============================
  // Business Days Configuration
  // ===============================

  async getBusinessDays(year: number): Promise<Array<{
    year: number;
    month: number;
    business_days: number;
    calculated_days: number | null;
    notes: string | null;
    updated_at: string | null;
  }>> {
    const response = await this.client.get<ApiResponse<Array<{
      year: number;
      month: number;
      business_days: number;
      calculated_days: number | null;
      notes: string | null;
      updated_at: string | null;
    }>>>(`/business-days/${year}`);
    return response.data.data;
  }

  async updateBusinessDays(
    year: number,
    month: number,
    businessDays: number,
    notes?: string
  ): Promise<{
    year: number;
    month: number;
    business_days: number;
    calculated_days: number;
    notes: string | null;
  }> {
    const response = await this.client.put<ApiResponse<{
      year: number;
      month: number;
      business_days: number;
      calculated_days: number;
      notes: string | null;
    }>>(`/business-days/${year}/${month}`, {
      business_days: businessDays,
      notes,
    });
    return response.data.data;
  }
}

export const api = new ApiService();
export default api;
