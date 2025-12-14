import axios from 'axios';
import db from '../database/index.js';
import logger from '../utils/logger.js';

const META_GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

class MetaAdsService {
  constructor() {
    this.config = null;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize service from database config
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const result = await db.query(`
        SELECT * FROM meta_ads_config
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        // Note: In production, decrypt the secrets
        this.config = {
          appId: row.app_id,
          appSecret: row.app_secret_encrypted, // Should be decrypted
          accessToken: row.access_token_encrypted, // Should be decrypted
          adAccountId: row.ad_account_id,
          pixelId: row.pixel_id,
          accountName: row.account_name,
          status: row.status,
          lastSync: row.last_sync_at,
          errorMessage: row.error_message,
        };

        this.setupClient();
        logger.info('Meta Ads service initialized from database');
      }
      this.initialized = true;
    } catch (error) {
      logger.warn('Meta Ads config table may not exist yet:', error.message);
      this.initialized = true;
    }
  }

  /**
   * Setup axios client with access token
   */
  setupClient() {
    if (this.config && this.config.accessToken) {
      this.client = axios.create({
        baseURL: META_GRAPH_API_BASE,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          access_token: this.config.accessToken,
        },
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Initialize the service with configuration and persist to database
   */
  async setConfig(config) {
    this.config = config;
    this.setupClient();

    // Persist to database
    try {
      await db.query(`
        INSERT INTO meta_ads_config (
          app_id, app_secret_encrypted, access_token_encrypted,
          ad_account_id, pixel_id, account_name, status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          app_id = EXCLUDED.app_id,
          app_secret_encrypted = EXCLUDED.app_secret_encrypted,
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          ad_account_id = EXCLUDED.ad_account_id,
          pixel_id = EXCLUDED.pixel_id,
          account_name = EXCLUDED.account_name,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        config.appId,
        config.appSecret, // Should be encrypted in production
        config.accessToken, // Should be encrypted in production
        config.adAccountId,
        config.pixelId || null,
        config.accountName || null,
        config.status || 'configured',
      ]);
      logger.info('Meta Ads config saved to database');
    } catch (error) {
      logger.warn('Could not persist Meta Ads config to database:', error.message);
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

  /**
   * Sync Meta Ads spend data to marketing_spend table
   */
  async syncSpendData(startDate, endDate) {
    if (!this.client || !this.config?.adAccountId) {
      throw new Error('Meta Ads não está configurado');
    }

    try {
      logger.info(`Syncing Meta Ads spend data from ${startDate} to ${endDate}`);

      // Fetch insights at campaign and adset level
      const insights = await this.getInsights({ start: startDate, end: endDate }, 'campaign');

      let syncedCount = 0;

      for (const insight of insights) {
        try {
          await db.query(`
            INSERT INTO marketing_spend (
              date, platform, campaign_id, campaign_name,
              adset_id, adset_name, spend, impressions, clicks,
              cpm, cpc, ctr, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            ON CONFLICT (date, platform, campaign_id, adset_id)
            DO UPDATE SET
              campaign_name = EXCLUDED.campaign_name,
              adset_name = EXCLUDED.adset_name,
              spend = EXCLUDED.spend,
              impressions = EXCLUDED.impressions,
              clicks = EXCLUDED.clicks,
              cpm = EXCLUDED.cpm,
              cpc = EXCLUDED.cpc,
              ctr = EXCLUDED.ctr,
              updated_at = CURRENT_TIMESTAMP
          `, [
            startDate, // Simplified: use period start date
            'meta',
            insight.campaignId,
            insight.campaignName,
            insight.adSetId || null,
            insight.adSetName || null,
            insight.spend,
            insight.impressions,
            insight.clicks,
            insight.cpm,
            insight.cpc,
            insight.ctr / 100, // Convert percentage to decimal
          ]);
          syncedCount++;
        } catch (err) {
          logger.warn(`Failed to sync insight for campaign ${insight.campaignId}:`, err.message);
        }
      }

      // Update last sync status
      await db.query(`
        UPDATE meta_ads_config
        SET last_sync_at = CURRENT_TIMESTAMP,
            last_sync_status = 'success'
        WHERE ad_account_id = $1
      `, [this.config.adAccountId]);

      logger.info(`Meta Ads spend sync complete: ${syncedCount} records`);
      return { syncedCount, totalInsights: insights.length };
    } catch (error) {
      logger.error('Error syncing Meta Ads spend:', error.message);

      await db.query(`
        UPDATE meta_ads_config
        SET last_sync_at = CURRENT_TIMESTAMP,
            last_sync_status = 'error',
            error_message = $1
        WHERE ad_account_id = $2
      `, [error.message, this.config?.adAccountId]);

      throw error;
    }
  }

  /**
   * Get marketing ROI metrics with lead correlation
   */
  async getMarketingROI(startDate, endDate) {
    try {
      // Get aggregated ROI from the view
      const result = await db.query(`
        SELECT
          source,
          SUM(total_leads) AS total_leads,
          SUM(converted_leads) AS converted_leads,
          SUM(total_revenue) AS total_revenue,
          SUM(total_spend) AS total_spend,
          CASE
            WHEN SUM(total_spend) > 0
            THEN ROUND((SUM(total_revenue) / SUM(total_spend))::numeric, 2)
            ELSE NULL
          END AS roas,
          CASE
            WHEN SUM(total_leads) > 0
            THEN ROUND((SUM(total_spend) / SUM(total_leads))::numeric, 2)
            ELSE NULL
          END AS cpl,
          CASE
            WHEN SUM(total_leads) > 0
            THEN ROUND((SUM(converted_leads)::decimal / SUM(total_leads) * 100)::numeric, 2)
            ELSE 0
          END AS conversion_rate
        FROM vw_marketing_roi_detailed
        WHERE lead_date >= $1 AND lead_date <= $2
        GROUP BY source
        ORDER BY total_leads DESC
      `, [startDate, endDate]);

      // Get totals
      const totalsResult = await db.query(`
        SELECT
          SUM(total_leads) AS total_leads,
          SUM(converted_leads) AS converted_leads,
          SUM(total_revenue) AS total_revenue,
          SUM(total_spend) AS total_spend
        FROM vw_marketing_roi_detailed
        WHERE lead_date >= $1 AND lead_date <= $2
      `, [startDate, endDate]);

      const totals = totalsResult.rows[0] || {};

      return {
        bySource: result.rows,
        totals: {
          totalLeads: parseInt(totals.total_leads) || 0,
          convertedLeads: parseInt(totals.converted_leads) || 0,
          totalRevenue: parseFloat(totals.total_revenue) || 0,
          totalSpend: parseFloat(totals.total_spend) || 0,
          roas: totals.total_spend > 0 ? (totals.total_revenue / totals.total_spend).toFixed(2) : null,
          cpl: totals.total_leads > 0 ? (totals.total_spend / totals.total_leads).toFixed(2) : null,
          conversionRate: totals.total_leads > 0
            ? ((totals.converted_leads / totals.total_leads) * 100).toFixed(2)
            : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting marketing ROI:', error.message);
      // Return empty data if views don't exist yet
      return {
        bySource: [],
        totals: {
          totalLeads: 0,
          convertedLeads: 0,
          totalRevenue: 0,
          totalSpend: 0,
          roas: null,
          cpl: null,
          conversionRate: 0,
        },
      };
    }
  }

  /**
   * Get daily marketing spend trend
   */
  async getSpendTrend(startDate, endDate) {
    try {
      const result = await db.query(`
        SELECT
          date,
          platform,
          SUM(spend) AS spend,
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks
        FROM marketing_spend
        WHERE date >= $1 AND date <= $2
        GROUP BY date, platform
        ORDER BY date
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting spend trend:', error.message);
      return [];
    }
  }
}

// Export singleton instance
export const metaAdsService = new MetaAdsService();
export default metaAdsService;
