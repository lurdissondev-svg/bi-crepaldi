import axios, { AxiosInstance } from 'axios';
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
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60s - API Belle pode demorar
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
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

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
export default api;
