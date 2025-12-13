import logger from '../utils/logger.js';
import { normalizePhone, normalizeEmail } from '../validators/dataValidator.js';

/**
 * Lead-to-Sale Correlator Service
 * Matches Bitrix24 leads with Belle Software sales to calculate
 * true conversion rates and ROI per source.
 */
class LeadSaleCorrelator {
  /**
   * Normalize phone number for comparison
   * Keeps only last 11 digits (DDD + number)
   */
  normalizePhone(phone) {
    return normalizePhone(phone);
  }

  /**
   * Normalize email for comparison
   */
  normalizeEmail(email) {
    return normalizeEmail(email);
  }

  /**
   * Extract phone numbers from a lead
   * @param {Object} lead - Bitrix24 lead object
   * @returns {string[]} Array of normalized phone numbers
   */
  extractLeadPhones(lead) {
    const phones = [];

    // Main phone fields
    if (lead.PHONE) {
      if (Array.isArray(lead.PHONE)) {
        lead.PHONE.forEach(p => {
          const normalized = this.normalizePhone(p.VALUE || p);
          if (normalized.length >= 8) phones.push(normalized);
        });
      } else if (typeof lead.PHONE === 'string') {
        const normalized = this.normalizePhone(lead.PHONE);
        if (normalized.length >= 8) phones.push(normalized);
      }
    }

    // Additional phone field
    if (lead.UF_CRM_TELEFONE) {
      const normalized = this.normalizePhone(lead.UF_CRM_TELEFONE);
      if (normalized.length >= 8) phones.push(normalized);
    }

    return [...new Set(phones)]; // Remove duplicates
  }

  /**
   * Extract emails from a lead
   * @param {Object} lead - Bitrix24 lead object
   * @returns {string[]} Array of normalized emails
   */
  extractLeadEmails(lead) {
    const emails = [];

    if (lead.EMAIL) {
      if (Array.isArray(lead.EMAIL)) {
        lead.EMAIL.forEach(e => {
          const normalized = this.normalizeEmail(e.VALUE || e);
          if (normalized.includes('@')) emails.push(normalized);
        });
      } else if (typeof lead.EMAIL === 'string') {
        const normalized = this.normalizeEmail(lead.EMAIL);
        if (normalized.includes('@')) emails.push(normalized);
      }
    }

    return [...new Set(emails)];
  }

  /**
   * Match a lead with a sale by phone or email
   * @param {Object} lead - Bitrix24 lead
   * @param {Object} sale - Belle sale
   * @param {string} matchBy - 'phone', 'email', or 'both'
   * @returns {{matched: boolean, matchedBy: string|null, confidence: number}}
   */
  matchRecord(lead, sale, matchBy = 'both') {
    const leadPhones = this.extractLeadPhones(lead);
    const leadEmails = this.extractLeadEmails(lead);

    // Get customer info from sale
    const salePhone = this.normalizePhone(sale.telefone || sale.celular || '');
    const saleEmail = this.normalizeEmail(sale.email || '');

    // Try phone match first (highest confidence)
    if ((matchBy === 'phone' || matchBy === 'both') && salePhone.length >= 8) {
      for (const phone of leadPhones) {
        // Exact match
        if (phone === salePhone) {
          return { matched: true, matchedBy: 'phone', confidence: 1.0 };
        }
        // Partial match (last 8 digits)
        if (phone.slice(-8) === salePhone.slice(-8)) {
          return { matched: true, matchedBy: 'phone_partial', confidence: 0.85 };
        }
      }
    }

    // Try email match (medium confidence)
    if ((matchBy === 'email' || matchBy === 'both') && saleEmail.includes('@')) {
      for (const email of leadEmails) {
        if (email === saleEmail) {
          return { matched: true, matchedBy: 'email', confidence: 0.9 };
        }
      }
    }

    return { matched: false, matchedBy: null, confidence: 0 };
  }

  /**
   * Correlate leads with sales
   * @param {Array} leads - Array of Bitrix24 leads
   * @param {Array} sales - Array of Belle sales
   * @param {string} matchBy - 'phone', 'email', or 'both'
   * @returns {Array} Leads with matched sales
   */
  correlateWithSales(leads, sales, matchBy = 'both') {
    if (!leads?.length || !sales?.length) {
      return leads.map(lead => ({
        ...lead,
        sale: null,
        converted: false,
        revenue: 0,
        matchedBy: null,
        matchConfidence: 0,
      }));
    }

    const correlatedLeads = leads.map(lead => {
      for (const sale of sales) {
        const { matched, matchedBy, confidence } = this.matchRecord(lead, sale, matchBy);
        if (matched) {
          return {
            ...lead,
            sale: {
              cod_venda: sale.cod_venda,
              valor_venda: parseFloat(sale.valor_venda) || 0,
              data_venda: sale.data_venda,
              nome_cliente: sale.nome_cliente,
            },
            converted: true,
            revenue: parseFloat(sale.valor_venda) || 0,
            matchedBy,
            matchConfidence: confidence,
          };
        }
      }

      return {
        ...lead,
        sale: null,
        converted: false,
        revenue: 0,
        matchedBy: null,
        matchConfidence: 0,
      };
    });

    return correlatedLeads;
  }

  /**
   * Calculate ROI per lead source
   * @param {Array} correlatedLeads - Leads with sales data
   * @returns {Array} ROI by source
   */
  calculateROIBySource(correlatedLeads) {
    const sourceStats = {};

    correlatedLeads.forEach(lead => {
      const source = lead.UTM_SOURCE || lead.SOURCE_ID || 'Desconhecido';

      if (!sourceStats[source]) {
        sourceStats[source] = {
          source,
          totalLeads: 0,
          convertedLeads: 0,
          totalRevenue: 0,
          conversions: [],
        };
      }

      sourceStats[source].totalLeads++;

      if (lead.converted) {
        sourceStats[source].convertedLeads++;
        sourceStats[source].totalRevenue += lead.revenue;
        sourceStats[source].conversions.push({
          leadId: lead.ID,
          revenue: lead.revenue,
          matchedBy: lead.matchedBy,
        });
      }
    });

    return Object.values(sourceStats).map(stats => ({
      source: stats.source,
      totalLeads: stats.totalLeads,
      convertedLeads: stats.convertedLeads,
      totalRevenue: stats.totalRevenue,
      conversionRate: stats.totalLeads > 0
        ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(2)
        : '0.00',
      avgRevenuePerLead: stats.totalLeads > 0
        ? (stats.totalRevenue / stats.totalLeads).toFixed(2)
        : '0.00',
      avgRevenuePerConversion: stats.convertedLeads > 0
        ? (stats.totalRevenue / stats.convertedLeads).toFixed(2)
        : '0.00',
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Calculate ROI per campaign
   * @param {Array} correlatedLeads - Leads with sales data
   * @returns {Array} ROI by campaign
   */
  calculateROIByCampaign(correlatedLeads) {
    const campaignStats = {};

    correlatedLeads.forEach(lead => {
      const campaign = lead.UTM_CAMPAIGN || 'Sem Campanha';

      if (!campaignStats[campaign]) {
        campaignStats[campaign] = {
          campaign,
          source: lead.UTM_SOURCE || 'Desconhecido',
          totalLeads: 0,
          convertedLeads: 0,
          totalRevenue: 0,
        };
      }

      campaignStats[campaign].totalLeads++;

      if (lead.converted) {
        campaignStats[campaign].convertedLeads++;
        campaignStats[campaign].totalRevenue += lead.revenue;
      }
    });

    return Object.values(campaignStats).map(stats => ({
      campaign: stats.campaign,
      source: stats.source,
      totalLeads: stats.totalLeads,
      convertedLeads: stats.convertedLeads,
      totalRevenue: stats.totalRevenue,
      conversionRate: stats.totalLeads > 0
        ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(2)
        : '0.00',
      avgRevenuePerLead: stats.totalLeads > 0
        ? (stats.totalRevenue / stats.totalLeads).toFixed(2)
        : '0.00',
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Get correlation summary
   * @param {Array} correlatedLeads - Leads with sales data
   * @returns {Object} Summary statistics
   */
  getSummary(correlatedLeads) {
    const totalLeads = correlatedLeads.length;
    const matchedLeads = correlatedLeads.filter(l => l.converted).length;
    const totalRevenue = correlatedLeads.reduce((sum, l) => sum + l.revenue, 0);

    const matchedByPhone = correlatedLeads.filter(l =>
      l.matchedBy === 'phone' || l.matchedBy === 'phone_partial'
    ).length;
    const matchedByEmail = correlatedLeads.filter(l => l.matchedBy === 'email').length;

    return {
      totalLeads,
      matchedLeads,
      unmatchedLeads: totalLeads - matchedLeads,
      totalRevenue,
      conversionRate: totalLeads > 0
        ? ((matchedLeads / totalLeads) * 100).toFixed(2)
        : '0.00',
      avgRevenuePerLead: totalLeads > 0
        ? (totalRevenue / totalLeads).toFixed(2)
        : '0.00',
      matchBreakdown: {
        phone: matchedByPhone,
        email: matchedByEmail,
        total: matchedLeads,
      },
    };
  }
}

export const leadSaleCorrelator = new LeadSaleCorrelator();
export default leadSaleCorrelator;
