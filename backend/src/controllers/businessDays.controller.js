import db from '../database/index.js';
import { contarDiasUteis } from '../utils/businessDays.js';
import logger from '../utils/logger.js';

const { pool } = db;

/**
 * Get business days configuration for a year
 * GET /api/business-days/:year
 */
export async function getBusinessDaysByYear(req, res) {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Ano inválido',
      });
    }

    const result = await pool.query(
      `SELECT year, month, business_days, calculated_days, notes, updated_at
       FROM business_days_config
       WHERE year = $1
       ORDER BY month`,
      [yearNum]
    );

    // If no data exists for this year, generate it
    if (result.rows.length === 0) {
      const months = [];
      for (let month = 1; month <= 12; month++) {
        const startDate = `${yearNum}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(yearNum, month, 0).getDate();
        const endDate = `${yearNum}-${String(month).padStart(2, '0')}-${lastDay}`;
        const calculatedDays = contarDiasUteis(startDate, endDate);

        months.push({
          year: yearNum,
          month,
          business_days: calculatedDays,
          calculated_days: calculatedDays,
          notes: null,
          updated_at: null,
        });
      }

      return res.json({
        success: true,
        data: months,
      });
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Erro ao buscar dias úteis:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar configuração de dias úteis',
      message: error.message,
    });
  }
}

/**
 * Update business days for a specific month
 * PUT /api/business-days/:year/:month
 */
export async function updateBusinessDays(req, res) {
  try {
    const { year, month } = req.params;
    const { business_days, notes } = req.body;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Ano inválido',
      });
    }

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Mês inválido',
      });
    }

    if (typeof business_days !== 'number' || business_days < 0 || business_days > 31) {
      return res.status(400).json({
        success: false,
        error: 'Número de dias úteis inválido (deve ser entre 0 e 31)',
      });
    }

    // Calculate the automatic value for reference
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
    const calculatedDays = contarDiasUteis(startDate, endDate);

    // Upsert the configuration
    const result = await pool.query(
      `INSERT INTO business_days_config (year, month, business_days, calculated_days, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (year, month)
       DO UPDATE SET
         business_days = EXCLUDED.business_days,
         calculated_days = EXCLUDED.calculated_days,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [yearNum, monthNum, business_days, calculatedDays, notes || null]
    );

    logger.info(`[BusinessDays] Atualizado ${monthNum}/${yearNum}: ${business_days} dias úteis`);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Erro ao atualizar dias úteis:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar configuração de dias úteis',
      message: error.message,
    });
  }
}

/**
 * Get business days for current month
 * Used by getMetas for calculating goals
 */
export async function getBusinessDaysForPeriod(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    // Check if we're looking at a single month
    const isSingleMonth = start.getFullYear() === end.getFullYear() &&
                          start.getMonth() === end.getMonth();

    if (isSingleMonth) {
      // Try to get configured value from database
      const result = await pool.query(
        `SELECT business_days FROM business_days_config WHERE year = $1 AND month = $2`,
        [year, month]
      );

      if (result.rows.length > 0) {
        return result.rows[0].business_days;
      }
    }

    // Fallback to calculated value
    return contarDiasUteis(startDate, endDate);
  } catch (error) {
    logger.warn('[BusinessDays] Erro ao buscar config, usando cálculo:', error.message);
    return contarDiasUteis(startDate, endDate);
  }
}

/**
 * Get passed business days for current month up to today
 */
export async function getPassedBusinessDaysForPeriod(startDate, endDate) {
  try {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    // Check if we're looking at a single month
    const isSingleMonth = start.getFullYear() === end.getFullYear() &&
                          start.getMonth() === end.getMonth();

    if (isSingleMonth) {
      // Get total configured business days for the month
      const result = await pool.query(
        `SELECT business_days FROM business_days_config WHERE year = $1 AND month = $2`,
        [year, month]
      );

      if (result.rows.length > 0) {
        const totalBusinessDays = result.rows[0].business_days;
        const lastDay = new Date(year, month, 0).getDate();

        // Calculate proportion of month passed
        const dayOfMonth = Math.min(today.getDate(), lastDay);
        const proportion = dayOfMonth / lastDay;

        // Return proportional business days passed (rounded)
        return Math.round(totalBusinessDays * proportion);
      }
    }

    // Fallback: calculate actual business days passed
    const { contarDiasUteisPassados } = await import('../utils/businessDays.js');
    return contarDiasUteisPassados(startDate, endDate);
  } catch (error) {
    logger.warn('[BusinessDays] Erro ao calcular dias passados:', error.message);
    const { contarDiasUteisPassados } = await import('../utils/businessDays.js');
    return contarDiasUteisPassados(startDate, endDate);
  }
}

export default {
  getBusinessDaysByYear,
  updateBusinessDays,
  getBusinessDaysForPeriod,
  getPassedBusinessDaysForPeriod,
};
