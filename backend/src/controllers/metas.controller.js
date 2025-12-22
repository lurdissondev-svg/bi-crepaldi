import db from '../database/index.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

const { pool } = db;

/**
 * Get metas configuration for a year
 * GET /api/metas-config/:year
 */
export async function getMetasByYear(req, res) {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Ano invalido',
      });
    }

    const result = await pool.query(
      `SELECT id, cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes, updated_at
       FROM metas_config
       WHERE year = $1
       ORDER BY estabelecimento_nome, month`,
      [yearNum]
    );

    // If no data exists, return default values from config
    if (result.rows.length === 0) {
      const defaultMetas = [];
      const estabelecimentos = [
        { cod_estab: 2, nome: 'SPA', ...config.metas.spa.metas },
        { cod_estab: 11, nome: 'SPA', ...config.metas.spa.metas },
        { cod_estab: 5, nome: 'Convenios', ...config.metas.convenios.metas },
        { cod_estab: 12, nome: 'Bela Laser', ...config.metas.belaLaser.metas },
        { cod_estab: 14, nome: 'Nutrologia', ...config.metas.nutrologia.metas },
      ];

      for (const estab of estabelecimentos) {
        for (let month = 1; month <= 12; month++) {
          defaultMetas.push({
            cod_estab: estab.cod_estab,
            estabelecimento_nome: estab.nome,
            year: yearNum,
            month,
            meta1: estab.meta1,
            meta2: estab.meta2,
            meta3: estab.meta3,
            notes: null,
            updated_at: null,
          });
        }
      }

      return res.json({
        success: true,
        data: defaultMetas,
      });
    }

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        meta1: parseFloat(row.meta1),
        meta2: parseFloat(row.meta2),
        meta3: parseFloat(row.meta3),
      })),
    });
  } catch (error) {
    logger.error('Erro ao buscar metas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar configuracao de metas',
      message: error.message,
    });
  }
}

/**
 * Get metas for a specific establishment and month
 * GET /api/metas-config/:year/:month/:codEstab
 */
export async function getMetasForEstabelecimento(req, res) {
  try {
    const { year, month, codEstab } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const codEstabNum = parseInt(codEstab);

    const result = await pool.query(
      `SELECT * FROM metas_config
       WHERE year = $1 AND month = $2 AND cod_estab = $3`,
      [yearNum, monthNum, codEstabNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Meta nao encontrada',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Erro ao buscar meta:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar meta',
    });
  }
}

/**
 * Update metas for a specific establishment and month
 * PUT /api/metas-config/:year/:month/:codEstab
 */
export async function updateMetas(req, res) {
  try {
    const { year, month, codEstab } = req.params;
    const { meta1, meta2, meta3, estabelecimento_nome, notes } = req.body;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const codEstabNum = parseInt(codEstab);

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Ano invalido',
      });
    }

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Mes invalido',
      });
    }

    if (isNaN(codEstabNum)) {
      return res.status(400).json({
        success: false,
        error: 'Codigo de estabelecimento invalido',
      });
    }

    // Validate meta values
    const meta1Val = parseFloat(meta1);
    const meta2Val = parseFloat(meta2);
    const meta3Val = parseFloat(meta3);

    if (isNaN(meta1Val) || isNaN(meta2Val) || isNaN(meta3Val)) {
      return res.status(400).json({
        success: false,
        error: 'Valores de meta invalidos',
      });
    }

    // Upsert the configuration
    const result = await pool.query(
      `INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (cod_estab, year, month)
       DO UPDATE SET
         meta1 = EXCLUDED.meta1,
         meta2 = EXCLUDED.meta2,
         meta3 = EXCLUDED.meta3,
         estabelecimento_nome = COALESCE(EXCLUDED.estabelecimento_nome, metas_config.estabelecimento_nome),
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [codEstabNum, estabelecimento_nome || 'Estabelecimento', yearNum, monthNum, meta1Val, meta2Val, meta3Val, notes || null]
    );

    logger.info(`[Metas] Atualizado estab ${codEstabNum} ${monthNum}/${yearNum}: M1=${meta1Val} M2=${meta2Val} M3=${meta3Val}`);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        meta1: parseFloat(result.rows[0].meta1),
        meta2: parseFloat(result.rows[0].meta2),
        meta3: parseFloat(result.rows[0].meta3),
      },
    });
  } catch (error) {
    logger.error('Erro ao atualizar metas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar configuracao de metas',
      message: error.message,
    });
  }
}

/**
 * Bulk update metas for all months of a year for an establishment
 * PUT /api/metas-config/:year/:codEstab/bulk
 */
export async function bulkUpdateMetas(req, res) {
  try {
    const { year, codEstab } = req.params;
    const { meta1, meta2, meta3, estabelecimento_nome, notes } = req.body;

    const yearNum = parseInt(year);
    const codEstabNum = parseInt(codEstab);

    const meta1Val = parseFloat(meta1);
    const meta2Val = parseFloat(meta2);
    const meta3Val = parseFloat(meta3);

    if (isNaN(meta1Val) || isNaN(meta2Val) || isNaN(meta3Val)) {
      return res.status(400).json({
        success: false,
        error: 'Valores de meta invalidos',
      });
    }

    // Update all months for this establishment and year
    const values = [];
    for (let month = 1; month <= 12; month++) {
      values.push(`(${codEstabNum}, '${estabelecimento_nome || 'Estabelecimento'}', ${yearNum}, ${month}, ${meta1Val}, ${meta2Val}, ${meta3Val}, ${notes ? `'${notes}'` : 'NULL'})`);
    }

    await pool.query(`
      INSERT INTO metas_config (cod_estab, estabelecimento_nome, year, month, meta1, meta2, meta3, notes)
      VALUES ${values.join(', ')}
      ON CONFLICT (cod_estab, year, month)
      DO UPDATE SET
        meta1 = EXCLUDED.meta1,
        meta2 = EXCLUDED.meta2,
        meta3 = EXCLUDED.meta3,
        estabelecimento_nome = COALESCE(EXCLUDED.estabelecimento_nome, metas_config.estabelecimento_nome),
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `);

    logger.info(`[Metas] Bulk update estab ${codEstabNum} year ${yearNum}: M1=${meta1Val} M2=${meta2Val} M3=${meta3Val}`);

    res.json({
      success: true,
      message: `Metas atualizadas para todos os meses de ${yearNum}`,
    });
  } catch (error) {
    logger.error('Erro ao atualizar metas em bulk:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar metas',
      message: error.message,
    });
  }
}

/**
 * Get metas for current period (used by dashboard)
 * Returns metas for the selected filters
 */
export async function getMetasForPeriod(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    const result = await pool.query(
      `SELECT cod_estab, estabelecimento_nome, meta1, meta2, meta3
       FROM metas_config
       WHERE year = $1 AND month = $2`,
      [year, month]
    );

    if (result.rows.length === 0) {
      // Return default values from config
      return {
        spa: config.metas.spa.metas,
        convenios: config.metas.convenios.metas,
        belaLaser: config.metas.belaLaser.metas,
        nutrologia: config.metas.nutrologia.metas,
      };
    }

    // Convert to map by cod_estab
    const metasMap = {};
    result.rows.forEach(row => {
      metasMap[row.cod_estab] = {
        nome: row.estabelecimento_nome,
        meta1: parseFloat(row.meta1),
        meta2: parseFloat(row.meta2),
        meta3: parseFloat(row.meta3),
      };
    });

    return metasMap;
  } catch (error) {
    logger.warn('[Metas] Erro ao buscar metas do periodo, usando config:', error.message);
    // Return default values from config
    return {
      spa: config.metas.spa.metas,
      convenios: config.metas.convenios.metas,
      belaLaser: config.metas.belaLaser.metas,
      nutrologia: config.metas.nutrologia.metas,
    };
  }
}

export default {
  getMetasByYear,
  getMetasForEstabelecimento,
  updateMetas,
  bulkUpdateMetas,
  getMetasForPeriod,
};
