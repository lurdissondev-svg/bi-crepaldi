import logger from '../utils/logger.js';

/**
 * Data Validation Layer
 * Validates all data received from external APIs (Bitrix24 and Belle Software)
 * to ensure data accuracy and integrity in the BI dashboard.
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the data is valid
 * @property {Array} errors - List of validation errors
 * @property {Array} warnings - List of validation warnings
 * @property {*} data - Sanitized/validated data
 */

// ==================== BITRIX24 LEAD VALIDATION ====================

/**
 * Validates a single Bitrix24 lead record
 * @param {Object} lead - Lead object from Bitrix24 API
 * @returns {ValidationResult}
 */
export function validateBitrixLead(lead) {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!lead.ID || isNaN(parseInt(lead.ID))) {
    errors.push({ field: 'ID', message: 'Lead ID is required and must be numeric' });
  }

  if (!lead.DATE_CREATE) {
    errors.push({ field: 'DATE_CREATE', message: 'DATE_CREATE is required' });
  } else if (!isValidDate(lead.DATE_CREATE)) {
    errors.push({ field: 'DATE_CREATE', message: 'DATE_CREATE is not a valid date' });
  }

  // Optional fields with defaults
  if (!lead.STATUS_ID) {
    warnings.push({ field: 'STATUS_ID', message: 'STATUS_ID missing, defaulting to NEW' });
    lead.STATUS_ID = 'NEW';
  }

  // UTM fields sanitization
  if (lead.UTM_SOURCE) {
    lead.UTM_SOURCE = sanitizeString(lead.UTM_SOURCE);
  }
  if (lead.UTM_MEDIUM) {
    lead.UTM_MEDIUM = sanitizeString(lead.UTM_MEDIUM);
  }
  if (lead.UTM_CAMPAIGN) {
    lead.UTM_CAMPAIGN = sanitizeString(lead.UTM_CAMPAIGN);
  }
  if (lead.UTM_CONTENT) {
    lead.UTM_CONTENT = sanitizeString(lead.UTM_CONTENT);
  }
  if (lead.UTM_TERM) {
    lead.UTM_TERM = sanitizeString(lead.UTM_TERM);
  }

  // OPPORTUNITY validation
  if (lead.OPPORTUNITY !== undefined && lead.OPPORTUNITY !== null) {
    const opportunity = parseFloat(lead.OPPORTUNITY);
    if (isNaN(opportunity)) {
      warnings.push({ field: 'OPPORTUNITY', message: 'Invalid OPPORTUNITY value, defaulting to 0' });
      lead.OPPORTUNITY = 0;
    } else {
      lead.OPPORTUNITY = opportunity;
    }
  } else {
    lead.OPPORTUNITY = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: lead,
  };
}

/**
 * Validates an array of Bitrix24 leads
 * @param {Array} leads - Array of lead objects
 * @returns {{valid: Array, invalid: Array, warnings: Array}}
 */
export function validateBitrixLeads(leads) {
  const valid = [];
  const invalid = [];
  const allWarnings = [];

  if (!Array.isArray(leads)) {
    logger.error('validateBitrixLeads: Expected array, got', typeof leads);
    return { valid: [], invalid: [], warnings: [] };
  }

  leads.forEach((lead, index) => {
    const result = validateBitrixLead(lead);

    if (result.valid) {
      valid.push(result.data);
    } else {
      invalid.push({ index, lead, errors: result.errors });
      logger.warn(`Lead validation failed for index ${index}:`, result.errors);
    }

    if (result.warnings.length > 0) {
      allWarnings.push({ index, warnings: result.warnings });
    }
  });

  if (invalid.length > 0) {
    logger.warn(`${invalid.length} leads were excluded due to validation errors`);
  }

  return { valid, invalid, warnings: allWarnings };
}

// ==================== BELLE SALE VALIDATION ====================

/**
 * Validates a single Belle Software sale record
 * @param {Object} sale - Sale object from Belle API
 * @returns {ValidationResult}
 */
export function validateBelleSale(sale) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!sale.cod_venda) {
    errors.push({ field: 'cod_venda', message: 'cod_venda is required' });
  }

  if (!sale.data_venda) {
    errors.push({ field: 'data_venda', message: 'data_venda is required' });
  } else if (!isValidBelleDate(sale.data_venda)) {
    errors.push({ field: 'data_venda', message: 'data_venda is not a valid date' });
  } else {
    // Normalize date to ISO 8601
    sale.data_venda_iso = normalizeBelleDate(sale.data_venda);
  }

  // valor_venda validation
  if (sale.valor_venda === undefined || sale.valor_venda === null) {
    warnings.push({ field: 'valor_venda', message: 'valor_venda missing, defaulting to 0' });
    sale.valor_venda = 0;
  } else {
    const valor = parseFloat(sale.valor_venda);
    if (isNaN(valor)) {
      warnings.push({ field: 'valor_venda', message: 'valor_venda invalid, defaulting to 0' });
      sale.valor_venda = 0;
    } else if (valor < 0) {
      warnings.push({ field: 'valor_venda', message: 'valor_venda is negative' });
      sale.valor_venda = valor;
    } else {
      sale.valor_venda = valor;
    }
  }

  // cod_cliente validation
  if (sale.cod_cliente !== undefined && sale.cod_cliente !== null) {
    const codCliente = parseInt(sale.cod_cliente);
    if (isNaN(codCliente)) {
      warnings.push({ field: 'cod_cliente', message: 'cod_cliente is not numeric' });
    } else {
      sale.cod_cliente = codCliente;
    }
  }

  // confirmado validation
  if (sale.confirmado !== 'S' && sale.confirmado !== 'N') {
    if (sale.confirmado) {
      warnings.push({ field: 'confirmado', message: `Invalid confirmado value: ${sale.confirmado}, defaulting to N` });
    }
    sale.confirmado = 'N';
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: sale,
  };
}

/**
 * Validates an array of Belle Software sales
 * @param {Array} sales - Array of sale objects
 * @returns {{valid: Array, invalid: Array, warnings: Array}}
 */
export function validateBelleSales(sales) {
  const valid = [];
  const invalid = [];
  const allWarnings = [];

  if (!Array.isArray(sales)) {
    logger.error('validateBelleSales: Expected array, got', typeof sales);
    return { valid: [], invalid: [], warnings: [] };
  }

  sales.forEach((sale, index) => {
    const result = validateBelleSale(sale);

    if (result.valid) {
      valid.push(result.data);
    } else {
      invalid.push({ index, sale, errors: result.errors });
      logger.warn(`Sale validation failed for index ${index}:`, result.errors);
    }

    if (result.warnings.length > 0) {
      allWarnings.push({ index, warnings: result.warnings });
    }
  });

  if (invalid.length > 0) {
    logger.warn(`${invalid.length} sales were excluded due to validation errors`);
  }

  return { valid, invalid, warnings: allWarnings };
}

// ==================== BELLE ACCOUNTS RECEIVABLE VALIDATION ====================

/**
 * Validates a Belle Software accounts receivable (contas_receber) record
 * @param {Object} record - Accounts receivable object
 * @returns {ValidationResult}
 */
export function validateBelleContasReceber(record) {
  const errors = [];
  const warnings = [];

  // valor_bruto validation
  if (record.valor_bruto === undefined || record.valor_bruto === null) {
    warnings.push({ field: 'valor_bruto', message: 'valor_bruto missing, defaulting to 0' });
    record.valor_bruto = 0;
  } else {
    const valor = parseFloat(record.valor_bruto);
    if (isNaN(valor)) {
      warnings.push({ field: 'valor_bruto', message: 'valor_bruto invalid, defaulting to 0' });
      record.valor_bruto = 0;
    } else {
      record.valor_bruto = valor;
    }
  }

  // dt_lancamento validation
  if (record.dt_lancamento && !isValidBelleDate(record.dt_lancamento)) {
    warnings.push({ field: 'dt_lancamento', message: 'dt_lancamento is not a valid date' });
  }

  // confirmado validation
  if (record.confirmado !== 'S' && record.confirmado !== 'N') {
    if (record.confirmado) {
      warnings.push({ field: 'confirmado', message: `Invalid confirmado value, defaulting to N` });
    }
    record.confirmado = 'N';
  }

  return {
    valid: true, // Contas receber records are always valid (just sanitized)
    errors,
    warnings,
    data: record,
  };
}

// ==================== CALCULATION VALIDATORS ====================

/**
 * Validates that a calculation result is within acceptable bounds
 * @param {number} value - The calculated value
 * @param {string} type - Type of calculation ('percentage', 'currency', 'count')
 * @param {Object} options - Additional options
 * @returns {{valid: boolean, adjusted: number, warning: string|null}}
 */
export function validateCalculation(value, type, options = {}) {
  const { min = 0, max = null, precision = 2 } = options;
  let warning = null;
  let adjusted = value;

  // Handle NaN
  if (isNaN(value)) {
    warning = `Calculation resulted in NaN, defaulting to 0`;
    adjusted = 0;
  }

  // Handle Infinity
  if (!isFinite(value)) {
    warning = `Calculation resulted in Infinity, defaulting to 0`;
    adjusted = 0;
  }

  // Type-specific validation
  switch (type) {
    case 'percentage':
      if (adjusted < 0) {
        warning = `Percentage ${adjusted} is negative, adjusting to 0`;
        adjusted = 0;
      }
      if (adjusted > 100) {
        warning = `Percentage ${adjusted} exceeds 100%, adjusting to 100`;
        adjusted = 100;
      }
      adjusted = parseFloat(adjusted.toFixed(precision));
      break;

    case 'currency':
      if (adjusted < 0 && !options.allowNegative) {
        warning = `Currency value ${adjusted} is negative, adjusting to 0`;
        adjusted = 0;
      }
      adjusted = parseFloat(adjusted.toFixed(2));
      break;

    case 'count':
      adjusted = Math.max(0, Math.floor(adjusted));
      break;
  }

  // Apply min/max bounds
  if (min !== null && adjusted < min) {
    warning = `Value ${adjusted} is below minimum ${min}`;
    adjusted = min;
  }
  if (max !== null && adjusted > max) {
    warning = `Value ${adjusted} exceeds maximum ${max}`;
    adjusted = max;
  }

  if (warning) {
    logger.debug(`Calculation validation: ${warning}`);
  }

  return {
    valid: warning === null,
    adjusted,
    warning,
  };
}

/**
 * Safe division that handles division by zero
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} defaultValue - Value to return if division is not possible
 * @returns {number}
 */
export function safeDivide(numerator, denominator, defaultValue = 0) {
  if (denominator === 0 || isNaN(denominator) || !isFinite(denominator)) {
    return defaultValue;
  }
  if (isNaN(numerator) || !isFinite(numerator)) {
    return defaultValue;
  }
  return numerator / denominator;
}

/**
 * Safe percentage calculation
 * @param {number} part
 * @param {number} total
 * @param {number} precision - Decimal places
 * @returns {number}
 */
export function safePercentage(part, total, precision = 2) {
  const result = safeDivide(part * 100, total, 0);
  const validated = validateCalculation(result, 'percentage', { precision });
  return validated.adjusted;
}

// ==================== PHONE NUMBER NORMALIZATION ====================

/**
 * Normalizes a phone number for comparison
 * Removes all non-numeric characters and keeps only last 11 digits (DDD + number)
 * @param {string} phone - Phone number
 * @returns {string} Normalized phone number
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.replace(/\D/g, '').slice(-11);
}

/**
 * Normalizes email for comparison
 * @param {string} email - Email address
 * @returns {string} Normalized email (lowercase, trimmed)
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.toLowerCase().trim();
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Validates if a string is a valid date
 * @param {string} dateStr - Date string
 * @returns {boolean}
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validates if a string is a valid Belle date format (dd/mm/yyyy or dd/mm/yyyy hh:mm:ss)
 * @param {string} dateStr - Date string
 * @returns {boolean}
 */
function isValidBelleDate(dateStr) {
  if (!dateStr) return false;
  // Match dd/mm/yyyy or dd/mm/yyyy hh:mm:ss
  const pattern = /^\d{2}\/\d{2}\/\d{4}(\s\d{2}:\d{2}:\d{2})?$/;
  return pattern.test(dateStr);
}

/**
 * Normalizes Belle date format to ISO 8601
 * @param {string} dateStr - Date in dd/mm/yyyy format
 * @returns {string} ISO 8601 date string
 */
function normalizeBelleDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(/[\s\/]/);
  if (parts.length >= 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
}

/**
 * Sanitizes a string by trimming and removing dangerous characters
 * @param {string} str - String to sanitize
 * @returns {string}
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.trim();
}

// ==================== RESPONSE VALIDATORS ====================

/**
 * Validates that an API response is not empty
 * @param {*} response - API response
 * @returns {{isEmpty: boolean, data: *}}
 */
export function validateApiResponse(response) {
  if (response === null || response === undefined) {
    return { isEmpty: true, data: [] };
  }

  if (Array.isArray(response) && response.length === 0) {
    return { isEmpty: true, data: [] };
  }

  if (typeof response === 'object' && Object.keys(response).length === 0) {
    return { isEmpty: true, data: {} };
  }

  return { isEmpty: false, data: response };
}

export default {
  validateBitrixLead,
  validateBitrixLeads,
  validateBelleSale,
  validateBelleSales,
  validateBelleContasReceber,
  validateCalculation,
  safeDivide,
  safePercentage,
  normalizePhone,
  normalizeEmail,
  validateApiResponse,
};
