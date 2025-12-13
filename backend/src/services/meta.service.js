import axios from 'axios';
import logger from '../utils/logger.js';

const META_GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

class MetaAdsService {
  constructor() {
    this.config = null;
    this.client = null;
  }

  /**
   * Initialize the service with configuration
   */
  setConfig(config) {
    this.config = config;

    if (config && config.accessToken) {
      this.client = axios.create({
        baseURL: META_GRAPH_API_BASE,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          access_token: config.accessToken,
        },
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    if (!this.config) {
      return null;
    }
    // Return config without exposing full secrets
    return {
      appId: this.config.appId,
      appSecret: this.config.appSecret ? '***' + this.config.appSecret.slice(-4) : '',
      accessToken: this.config.accessToken ? '***' + this.config.accessToken.slice(-8) : '',
      adAccountId: this.config.adAccountId,
      pixelId: this.config.pixelId,
      status: this.config.status || 'pending',
      lastSync: this.config.lastSync,
      errorMessage: this.config.errorMessage,
    };
  }

  /**
   * Validate credentials with Meta API
   */
  async validateCredentials(credentials) {
    const { appId, appSecret, accessToken, adAccountId } = credentials;

    if (!appId || !appSecret || !accessToken || !adAccountId) {
      return {
        valid: false,
        message: 'Todos os campos obrigatórios devem ser preenchidos',
      };
    }

    try {
      // Create temporary client for validation
      const tempClient = axios.create({
        baseURL: META_GRAPH_API_BASE,
        timeout: 30000,
        params: {
          access_token: accessToken,
        },
      });

      // Test the access token by fetching token debug info
      const debugResponse = await tempClient.get('/debug_token', {
        params: {
          input_token: accessToken,
          access_token: `${appId}|${appSecret}`,
        },
      });

      const tokenData = debugResponse.data.data;

      if (!tokenData.is_valid) {
        return {
          valid: false,
          message: 'Token de acesso inválido ou expirado',
        };
      }

      // Check token expiration
      if (tokenData.expires_at && tokenData.expires_at < Date.now() / 1000) {
        return {
          valid: false,
          message: 'Token de acesso expirado',
        };
      }

      // Verify ad account access
      const accountResponse = await tempClient.get(`/act_${adAccountId}`, {
        params: {
          fields: 'id,name,account_status,currency,business_name',
        },
      });

      const accountData = accountResponse.data;

      // Check account status (1 = active)
      if (accountData.account_status !== 1) {
        const statusMessages = {
          2: 'Conta de anúncios desativada',
          3: 'Conta de anúncios não aprovada',
          7: 'Conta de anúncios pendente de revisão',
          9: 'Conta de anúncios em período de carência',
          100: 'Conta de anúncios pendente de fechamento',
          101: 'Conta de anúncios fechada',
        };
        return {
          valid: false,
          message: statusMessages[accountData.account_status] || 'Conta de anúncios com problema',
        };
      }

      // Get granted permissions
      const permissions = tokenData.scopes || [];

      // Check required permissions
      const requiredPermissions = ['ads_read', 'read_insights'];
      const missingPermissions = requiredPermissions.filter(p => !permissions.includes(p));

      if (missingPermissions.length > 0) {
        logger.warn('Missing Meta Ads permissions:', missingPermissions);
      }

      return {
        valid: true,
        message: 'Credenciais válidas',
        accountName: accountData.business_name || accountData.name,
        accountId: accountData.id,
        currency: accountData.currency,
        permissions,
        tokenExpiry: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
      };
    } catch (error) {
      logger.error('Meta Ads validation error:', error.response?.data || error.message);

      // Parse Meta API error
      const metaError = error.response?.data?.error;
      if (metaError) {
        if (metaError.code === 190) {
          return {
            valid: false,
            message: 'Token de acesso inválido ou expirado',
          };
        }
        if (metaError.code === 100) {
          return {
            valid: false,
            message: 'ID da conta de anúncios inválido',
          };
        }
        if (metaError.code === 10) {
          return {
            valid: false,
            message: 'Permissão negada para acessar a conta de anúncios',
          };
        }
        return {
          valid: false,
          message: metaError.message || 'Erro ao validar credenciais',
        };
      }

      return {
        valid: false,
        message: 'Erro ao conectar com a API do Meta: ' + error.message,
      };
    }
  }

  /**
   * Fetch ad account insights
   */
  async getInsights(dateRange, breakdown = 'campaign') {
    if (!this.client || !this.config?.adAccountId) {
      throw new Error('Meta Ads não está configurado');
    }

    try {
      const response = await this.client.get(`/act_${this.config.adAccountId}/insights`, {
        params: {
          time_range: JSON.stringify({
            since: dateRange.start,
            until: dateRange.end,
          }),
          fields: [
            'campaign_id',
            'campaign_name',
            'adset_id',
            'adset_name',
            'ad_id',
            'ad_name',
            'impressions',
            'clicks',
            'spend',
            'reach',
            'cpc',
            'cpm',
            'ctr',
            'actions',
            'conversions',
            'cost_per_action_type',
          ].join(','),
          level: breakdown,
          limit: 500,
        },
      });

      return this.transformInsights(response.data.data || []);
    } catch (error) {
      logger.error('Error fetching Meta Ads insights:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetch campaigns
   */
  async getCampaigns(status = 'ACTIVE') {
    if (!this.client || !this.config?.adAccountId) {
      throw new Error('Meta Ads não está configurado');
    }

    try {
      const response = await this.client.get(`/act_${this.config.adAccountId}/campaigns`, {
        params: {
          fields: [
            'id',
            'name',
            'status',
            'objective',
            'daily_budget',
            'lifetime_budget',
            'created_time',
            'updated_time',
          ].join(','),
          filtering: JSON.stringify([
            { field: 'effective_status', operator: 'IN', value: [status] },
          ]),
          limit: 100,
        },
      });

      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching Meta Ads campaigns:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Transform insights data to a more usable format
   */
  transformInsights(insights) {
    return insights.map(insight => {
      // Extract lead and purchase actions
      const actions = insight.actions || [];
      const leads = actions.find(a => a.action_type === 'lead')?.value || 0;
      const purchases = actions.find(a => a.action_type === 'purchase')?.value || 0;
      const linkClicks = actions.find(a => a.action_type === 'link_click')?.value || insight.clicks || 0;

      // Extract cost per action
      const costPerAction = insight.cost_per_action_type || [];
      const costPerLead = costPerAction.find(c => c.action_type === 'lead')?.value || null;
      const costPerPurchase = costPerAction.find(c => c.action_type === 'purchase')?.value || null;

      return {
        campaignId: insight.campaign_id,
        campaignName: insight.campaign_name,
        adSetId: insight.adset_id,
        adSetName: insight.adset_name,
        adId: insight.ad_id,
        adName: insight.ad_name,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        spend: parseFloat(insight.spend) || 0,
        reach: parseInt(insight.reach) || 0,
        cpc: parseFloat(insight.cpc) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        leads: parseInt(leads),
        purchases: parseInt(purchases),
        linkClicks: parseInt(linkClicks),
        costPerLead: costPerLead ? parseFloat(costPerLead) : null,
        costPerPurchase: costPerPurchase ? parseFloat(costPerPurchase) : null,
      };
    });
  }

  /**
   * Get summary metrics
   */
  async getSummary(dateRange) {
    const insights = await this.getInsights(dateRange, 'account');

    if (!insights || insights.length === 0) {
      return {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalLeads: 0,
        totalReach: 0,
        avgCpc: 0,
        avgCpm: 0,
        avgCtr: 0,
        costPerLead: null,
      };
    }

    // Aggregate all insights
    const summary = insights.reduce((acc, insight) => ({
      totalSpend: acc.totalSpend + insight.spend,
      totalImpressions: acc.totalImpressions + insight.impressions,
      totalClicks: acc.totalClicks + insight.clicks,
      totalLeads: acc.totalLeads + insight.leads,
      totalReach: acc.totalReach + insight.reach,
    }), {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLeads: 0,
      totalReach: 0,
    });

    // Calculate averages
    summary.avgCpc = summary.totalClicks > 0 ? summary.totalSpend / summary.totalClicks : 0;
    summary.avgCpm = summary.totalImpressions > 0 ? (summary.totalSpend / summary.totalImpressions) * 1000 : 0;
    summary.avgCtr = summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions) * 100 : 0;
    summary.costPerLead = summary.totalLeads > 0 ? summary.totalSpend / summary.totalLeads : null;

    return summary;
  }
}

// Export singleton instance
export const metaAdsService = new MetaAdsService();
export default metaAdsService;
