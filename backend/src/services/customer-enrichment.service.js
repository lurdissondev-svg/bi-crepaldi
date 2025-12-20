import db from '../database/index.js';
import logger, { startTimer } from '../utils/logger.js';
import { normalizePhone, normalizeEmail } from '../validators/dataValidator.js';

/**
 * Serviço de Enriquecimento de Dados de Clientes
 * Preenche automaticamente telefone, celular e email faltantes
 * a partir de múltiplas fontes de dados.
 *
 * Fontes (por prioridade):
 * 1. Leads Bitrix24 correlacionados
 * 2. Raw data de contas_receber e vendas
 * 3. Mesmo cliente em outros estabelecimentos
 */
class CustomerEnrichmentService {
  constructor() {
    this.batchSize = 100; // Processa 100 clientes por vez
    this.lastRunStats = null;
  }

  // ==================== VALIDAÇÃO ====================

  /**
   * Valida número de telefone brasileiro
   * @param {string} phone - Número de telefone
   * @returns {boolean}
   */
  isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const normalized = phone.replace(/\D/g, '');
    // 8-11 dígitos (com ou sem DDD, com ou sem 9)
    return normalized.length >= 8 && normalized.length <= 11;
  }

  /**
   * Valida email básico
   * @param {string} email - Endereço de email
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim().toLowerCase();
    // Regex básico para email
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  // ==================== BUSCA DE CLIENTES ====================

  /**
   * Busca clientes com dados de contato faltantes
   * @param {number} limit - Limite de registros
   * @returns {Promise<Array>}
   */
  async findCustomersWithMissingData(limit = 100) {
    const result = await db.query(`
      SELECT
        c.id,
        c.cod_cliente,
        c.cod_estab,
        c.nome,
        c.telefone,
        c.celular,
        c.email
      FROM clientes c
      WHERE (c.telefone IS NULL OR c.telefone = '')
         OR (c.celular IS NULL OR c.celular = '')
         OR (c.email IS NULL OR c.email = '')
      ORDER BY c.id
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  // ==================== ENRIQUECIMENTO POR FONTE ====================

  /**
   * Enriquece cliente a partir de leads Bitrix correlacionados
   * @param {Object} cliente - Objeto cliente
   * @returns {Promise<Object|null>} Dados encontrados ou null
   */
  async enrichFromBitrixLeads(cliente) {
    try {
      // Busca leads correlacionados via vendas do cliente
      const result = await db.query(`
        SELECT l.id as lead_id, l.telefones, l.emails, l.bitrix_created_at
        FROM leads l
        INNER JOIN lead_sale_correlations lsc ON l.id = lsc.lead_id
        INNER JOIN vendas v ON lsc.venda_id = v.id
        WHERE v.cod_cliente = $1
          AND (l.telefones IS NOT NULL AND l.telefones != '[]'
               OR l.emails IS NOT NULL AND l.emails != '[]')
        GROUP BY l.id, l.telefones, l.emails, l.bitrix_created_at
        ORDER BY l.bitrix_created_at DESC
        LIMIT 5
      `, [cliente.cod_cliente]);

      if (result.rows.length === 0) return null;

      const enriched = { source: 'bitrix_lead', sourceId: null };

      for (const lead of result.rows) {
        enriched.sourceId = lead.lead_id;

        // Extrair telefones
        if (!enriched.telefone && !enriched.celular) {
          const telefones = lead.telefones || [];
          for (const tel of telefones) {
            const value = tel.VALUE || tel;
            if (value && this.isValidPhone(value)) {
              const normalized = normalizePhone(value);
              if (normalized.length === 11) {
                // Celular (11 dígitos com 9)
                if (!enriched.celular) enriched.celular = normalized;
              } else {
                // Telefone fixo
                if (!enriched.telefone) enriched.telefone = normalized;
              }
            }
          }
        }

        // Extrair emails
        if (!enriched.email) {
          const emails = lead.emails || [];
          for (const em of emails) {
            const value = em.VALUE || em;
            if (value && this.isValidEmail(value)) {
              enriched.email = normalizeEmail(value);
              break;
            }
          }
        }

        // Se encontrou tudo, para
        if (enriched.telefone && enriched.celular && enriched.email) break;
      }

      // Retorna se encontrou algo útil
      if (enriched.telefone || enriched.celular || enriched.email) {
        return enriched;
      }
      return null;
    } catch (error) {
      logger.debug(`[Enrichment] Erro ao buscar leads para cliente ${cliente.cod_cliente}: ${error.message}`);
      return null;
    }
  }

  /**
   * Enriquece cliente a partir do raw_data de contas_receber e vendas
   * @param {Object} cliente - Objeto cliente
   * @returns {Promise<Object|null>} Dados encontrados ou null
   */
  async enrichFromRawData(cliente) {
    try {
      // Busca dados no raw_data de contas_receber
      const contasResult = await db.query(`
        SELECT
          id,
          raw_data->>'telefone_cliente' as telefone,
          raw_data->>'celular_cliente' as celular,
          raw_data->>'email_cliente' as email,
          raw_data->>'telefone' as telefone_alt,
          raw_data->>'celular' as celular_alt
        FROM contas_receber
        WHERE cod_cliente = $1
          AND cod_estab = $2
          AND raw_data IS NOT NULL
        ORDER BY dt_lancamento DESC
        LIMIT 10
      `, [cliente.cod_cliente, cliente.cod_estab]);

      const enriched = { source: 'raw_data', sourceId: null };

      for (const row of contasResult.rows) {
        enriched.sourceId = `conta_${row.id}`;

        // Telefone
        if (!enriched.telefone) {
          const tel = row.telefone || row.telefone_alt;
          if (tel && this.isValidPhone(tel)) {
            enriched.telefone = normalizePhone(tel);
          }
        }

        // Celular
        if (!enriched.celular) {
          const cel = row.celular || row.celular_alt;
          if (cel && this.isValidPhone(cel)) {
            enriched.celular = normalizePhone(cel);
          }
        }

        // Email
        if (!enriched.email && row.email && this.isValidEmail(row.email)) {
          enriched.email = normalizeEmail(row.email);
        }

        if (enriched.telefone && enriched.celular && enriched.email) break;
      }

      // Busca também em vendas se ainda falta algo
      if (!enriched.telefone || !enriched.celular || !enriched.email) {
        const vendasResult = await db.query(`
          SELECT
            id,
            raw_data->>'telefone' as telefone,
            raw_data->>'celular' as celular,
            raw_data->>'email' as email
          FROM vendas
          WHERE cod_cliente = $1
            AND cod_estab = $2
            AND raw_data IS NOT NULL
          ORDER BY data_venda DESC
          LIMIT 5
        `, [cliente.cod_cliente, cliente.cod_estab]);

        for (const row of vendasResult.rows) {
          if (!enriched.sourceId) enriched.sourceId = `venda_${row.id}`;

          if (!enriched.telefone && row.telefone && this.isValidPhone(row.telefone)) {
            enriched.telefone = normalizePhone(row.telefone);
          }
          if (!enriched.celular && row.celular && this.isValidPhone(row.celular)) {
            enriched.celular = normalizePhone(row.celular);
          }
          if (!enriched.email && row.email && this.isValidEmail(row.email)) {
            enriched.email = normalizeEmail(row.email);
          }

          if (enriched.telefone && enriched.celular && enriched.email) break;
        }
      }

      if (enriched.telefone || enriched.celular || enriched.email) {
        return enriched;
      }
      return null;
    } catch (error) {
      logger.debug(`[Enrichment] Erro ao buscar raw_data para cliente ${cliente.cod_cliente}: ${error.message}`);
      return null;
    }
  }

  /**
   * Enriquece cliente a partir de outros estabelecimentos
   * @param {Object} cliente - Objeto cliente
   * @returns {Promise<Object|null>} Dados encontrados ou null
   */
  async consolidateAcrossEstablishments(cliente) {
    try {
      // Busca o mesmo cod_cliente em outros estabelecimentos
      const result = await db.query(`
        SELECT
          id,
          cod_estab,
          telefone,
          celular,
          email
        FROM clientes
        WHERE cod_cliente = $1
          AND cod_estab != $2
          AND (telefone IS NOT NULL AND telefone != ''
               OR celular IS NOT NULL AND celular != ''
               OR email IS NOT NULL AND email != '')
        ORDER BY updated_at DESC
        LIMIT 5
      `, [cliente.cod_cliente, cliente.cod_estab]);

      if (result.rows.length === 0) return null;

      const enriched = { source: 'cross_estab', sourceId: null };

      for (const row of result.rows) {
        enriched.sourceId = `cliente_${row.id}_estab_${row.cod_estab}`;

        if (!enriched.telefone && row.telefone && this.isValidPhone(row.telefone)) {
          enriched.telefone = normalizePhone(row.telefone);
        }
        if (!enriched.celular && row.celular && this.isValidPhone(row.celular)) {
          enriched.celular = normalizePhone(row.celular);
        }
        if (!enriched.email && row.email && this.isValidEmail(row.email)) {
          enriched.email = normalizeEmail(row.email);
        }

        if (enriched.telefone && enriched.celular && enriched.email) break;
      }

      if (enriched.telefone || enriched.celular || enriched.email) {
        return enriched;
      }
      return null;
    } catch (error) {
      logger.debug(`[Enrichment] Erro ao buscar cross-estab para cliente ${cliente.cod_cliente}: ${error.message}`);
      return null;
    }
  }

  // ==================== ATUALIZAÇÃO ====================

  /**
   * Atualiza cliente e registra log de enriquecimento
   * @param {Object} cliente - Cliente original
   * @param {Object} enrichedData - Dados para enriquecer
   * @returns {Promise<Object>} Resultado da atualização
   */
  async applyEnrichment(cliente, enrichedData) {
    const updates = [];
    const logs = [];

    // Verifica cada campo
    if (!cliente.telefone && enrichedData.telefone) {
      updates.push({ field: 'telefone', value: enrichedData.telefone });
      logs.push({
        field: 'telefone',
        oldValue: cliente.telefone,
        newValue: enrichedData.telefone,
        source: enrichedData.source,
        sourceId: enrichedData.sourceId,
      });
    }

    if (!cliente.celular && enrichedData.celular) {
      updates.push({ field: 'celular', value: enrichedData.celular });
      logs.push({
        field: 'celular',
        oldValue: cliente.celular,
        newValue: enrichedData.celular,
        source: enrichedData.source,
        sourceId: enrichedData.sourceId,
      });
    }

    if (!cliente.email && enrichedData.email) {
      updates.push({ field: 'email', value: enrichedData.email });
      logs.push({
        field: 'email',
        oldValue: cliente.email,
        newValue: enrichedData.email,
        source: enrichedData.source,
        sourceId: enrichedData.sourceId,
      });
    }

    if (updates.length === 0) {
      return { updated: false, fields: [] };
    }

    // Monta query de update dinâmico
    const setClauses = updates.map((u, i) => `${u.field} = $${i + 1}`);
    setClauses.push(`enriched_at = NOW()`);
    setClauses.push(`enrichment_source = $${updates.length + 1}`);

    const values = updates.map(u => u.value);
    values.push(enrichedData.source);
    values.push(cliente.id);

    await db.query(`
      UPDATE clientes
      SET ${setClauses.join(', ')}
      WHERE id = $${updates.length + 2}
    `, values);

    // Registra logs de enriquecimento
    for (const log of logs) {
      await db.query(`
        INSERT INTO customer_enrichment_log
          (cliente_id, cod_cliente, cod_estab, field_name, old_value, new_value, source, source_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        cliente.id,
        cliente.cod_cliente,
        cliente.cod_estab,
        log.field,
        log.oldValue,
        log.newValue,
        log.source,
        log.sourceId,
      ]);
    }

    return {
      updated: true,
      fields: logs.map(l => l.field),
      source: enrichedData.source,
    };
  }

  // ==================== ORQUESTRAÇÃO ====================

  /**
   * Executa o processo completo de enriquecimento
   * @param {Object} options - Opções de execução
   * @returns {Promise<Object>} Estatísticas da execução
   */
  async runEnrichment(options = {}) {
    const { limit = this.batchSize, dryRun = false } = options;
    const timer = startTimer('Customer Enrichment');

    const stats = {
      processed: 0,
      enriched: 0,
      bySource: {
        bitrix_lead: 0,
        raw_data: 0,
        cross_estab: 0,
      },
      byField: {
        telefone: 0,
        celular: 0,
        email: 0,
      },
      errors: 0,
      startedAt: new Date(),
      finishedAt: null,
      dryRun,
    };

    logger.info(`[Enrichment] Iniciando enriquecimento de clientes (limit=${limit}, dryRun=${dryRun})...`);

    try {
      const clientes = await this.findCustomersWithMissingData(limit);
      logger.info(`[Enrichment] Encontrados ${clientes.length} clientes com dados faltantes`);

      for (const cliente of clientes) {
        stats.processed++;

        try {
          // Tenta cada fonte na ordem de prioridade
          let enrichedData = null;

          // 1. Bitrix leads
          if (!enrichedData) {
            enrichedData = await this.enrichFromBitrixLeads(cliente);
          }

          // 2. Raw data (se ainda precisa de algo)
          if (!enrichedData || this.needsMoreData(cliente, enrichedData)) {
            const rawData = await this.enrichFromRawData(cliente);
            if (rawData) {
              enrichedData = this.mergeEnrichedData(enrichedData, rawData, cliente);
            }
          }

          // 3. Cross-establishment (se ainda precisa de algo)
          if (!enrichedData || this.needsMoreData(cliente, enrichedData)) {
            const crossData = await this.consolidateAcrossEstablishments(cliente);
            if (crossData) {
              enrichedData = this.mergeEnrichedData(enrichedData, crossData, cliente);
            }
          }

          // Aplica enriquecimento se encontrou dados
          if (enrichedData) {
            if (dryRun) {
              logger.debug(`[Enrichment] DRY-RUN: Cliente ${cliente.cod_cliente} seria enriquecido com ${JSON.stringify(enrichedData)}`);
              stats.enriched++;
              this.updateStatsFromData(stats, enrichedData);
            } else {
              const result = await this.applyEnrichment(cliente, enrichedData);
              if (result.updated) {
                stats.enriched++;
                stats.bySource[enrichedData.source]++;
                result.fields.forEach(f => stats.byField[f]++);
              }
            }
          }
        } catch (error) {
          stats.errors++;
          logger.debug(`[Enrichment] Erro ao processar cliente ${cliente.cod_cliente}: ${error.message}`);
        }
      }

      stats.finishedAt = new Date();
      this.lastRunStats = stats;

      timer({ status: 'success', enriched: stats.enriched });
      logger.info(`[Enrichment] Finalizado: ${stats.enriched} de ${stats.processed} clientes enriquecidos`);
      logger.info(`[Enrichment] Por fonte: bitrix=${stats.bySource.bitrix_lead}, raw_data=${stats.bySource.raw_data}, cross_estab=${stats.bySource.cross_estab}`);
      logger.info(`[Enrichment] Por campo: telefone=${stats.byField.telefone}, celular=${stats.byField.celular}, email=${stats.byField.email}`);

      return stats;
    } catch (error) {
      timer({ status: 'error' });
      logger.error('[Enrichment] Erro no processo de enriquecimento:', error.message);
      throw error;
    }
  }

  /**
   * Verifica se cliente ainda precisa de mais dados
   */
  needsMoreData(cliente, enrichedData) {
    const needsTelefone = !cliente.telefone && !enrichedData?.telefone;
    const needsCelular = !cliente.celular && !enrichedData?.celular;
    const needsEmail = !cliente.email && !enrichedData?.email;
    return needsTelefone || needsCelular || needsEmail;
  }

  /**
   * Mescla dados de múltiplas fontes, priorizando a primeira
   */
  mergeEnrichedData(primary, secondary, cliente) {
    if (!primary) return secondary;
    if (!secondary) return primary;

    return {
      telefone: primary.telefone || (cliente.telefone ? null : secondary.telefone),
      celular: primary.celular || (cliente.celular ? null : secondary.celular),
      email: primary.email || (cliente.email ? null : secondary.email),
      source: primary.source, // Mantém a fonte primária
      sourceId: primary.sourceId,
    };
  }

  /**
   * Atualiza estatísticas a partir de dados enriquecidos (para dry-run)
   */
  updateStatsFromData(stats, enrichedData) {
    if (enrichedData.source) stats.bySource[enrichedData.source]++;
    if (enrichedData.telefone) stats.byField.telefone++;
    if (enrichedData.celular) stats.byField.celular++;
    if (enrichedData.email) stats.byField.email++;
  }

  // ==================== MÉTRICAS ====================

  /**
   * Retorna estatísticas de qualidade dos dados de contato
   * @returns {Promise<Object>}
   */
  async getDataQualityStats() {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*) as total_clientes,
          COUNT(CASE WHEN telefone IS NOT NULL AND telefone != '' THEN 1 END) as com_telefone,
          COUNT(CASE WHEN celular IS NOT NULL AND celular != '' THEN 1 END) as com_celular,
          COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as com_email,
          COUNT(CASE WHEN enriched_at IS NOT NULL THEN 1 END) as enriquecidos,
          COUNT(CASE WHEN enrichment_source = 'bitrix_lead' THEN 1 END) as enriquecidos_bitrix,
          COUNT(CASE WHEN enrichment_source = 'raw_data' THEN 1 END) as enriquecidos_raw,
          COUNT(CASE WHEN enrichment_source = 'cross_estab' THEN 1 END) as enriquecidos_cross
        FROM clientes
      `);

      const stats = result.rows[0];
      const total = parseInt(stats.total_clientes) || 1;

      return {
        total: parseInt(stats.total_clientes) || 0,
        comTelefone: parseInt(stats.com_telefone) || 0,
        comCelular: parseInt(stats.com_celular) || 0,
        comEmail: parseInt(stats.com_email) || 0,
        enriquecidos: parseInt(stats.enriquecidos) || 0,
        porFonte: {
          bitrix_lead: parseInt(stats.enriquecidos_bitrix) || 0,
          raw_data: parseInt(stats.enriquecidos_raw) || 0,
          cross_estab: parseInt(stats.enriquecidos_cross) || 0,
        },
        percentuais: {
          telefone: Math.round((parseInt(stats.com_telefone) / total) * 100),
          celular: Math.round((parseInt(stats.com_celular) / total) * 100),
          email: Math.round((parseInt(stats.com_email) / total) * 100),
          enriquecidos: Math.round((parseInt(stats.enriquecidos) / total) * 100),
        },
      };
    } catch (error) {
      logger.error('[Enrichment] Erro ao buscar estatísticas:', error.message);
      return null;
    }
  }

  /**
   * Retorna histórico de enriquecimentos
   * @param {number} limit - Limite de registros
   * @returns {Promise<Array>}
   */
  async getEnrichmentHistory(limit = 50) {
    try {
      const result = await db.query(`
        SELECT
          cel.id,
          cel.cod_cliente,
          cel.cod_estab,
          cel.field_name,
          cel.old_value,
          cel.new_value,
          cel.source,
          cel.enriched_at,
          c.nome as cliente_nome
        FROM customer_enrichment_log cel
        LEFT JOIN clientes c ON cel.cliente_id = c.id
        ORDER BY cel.enriched_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('[Enrichment] Erro ao buscar histórico:', error.message);
      return [];
    }
  }

  /**
   * Retorna status da última execução
   */
  getLastRunStatus() {
    return this.lastRunStats;
  }
}

export const customerEnrichmentService = new CustomerEnrichmentService();
export default customerEnrichmentService;
