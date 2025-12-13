import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, '../../logs');

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, duration, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (duration) {
    log += ` (${duration}ms)`;
  }
  if (Object.keys(meta).length > 0 && meta.service !== 'bi-crepaldi') {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bi-crepaldi' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      customFormat
    ),
  }));
}

/**
 * Timer utility for measuring operation duration
 * @param {string} operation - Name of the operation being timed
 * @returns {Function} - Function to call when operation completes
 */
export function startTimer(operation) {
  const start = Date.now();
  return (meta = {}) => {
    const duration = Date.now() - start;
    const level = duration > 5000 ? 'warn' : 'debug';
    logger.log(level, `${operation} completed`, { duration, ...meta });
    return duration;
  };
}

/**
 * Log a data inconsistency for debugging
 * @param {string} source - Source of the data (e.g., 'Bitrix24', 'Belle')
 * @param {string} issue - Description of the inconsistency
 * @param {object} data - Related data for debugging
 */
export function logDataInconsistency(source, issue, data = {}) {
  logger.warn(`Data inconsistency in ${source}: ${issue}`, {
    source,
    issue,
    data,
    type: 'data_inconsistency',
  });
}

/**
 * Log an API call with timing
 * @param {string} service - Service name
 * @param {string} method - API method called
 * @param {number} duration - Duration in ms
 * @param {boolean} success - Whether the call succeeded
 */
export function logApiCall(service, method, duration, success = true) {
  const level = success ? (duration > 5000 ? 'warn' : 'debug') : 'error';
  logger.log(level, `API call to ${service}:${method}`, {
    service,
    method,
    duration,
    success,
    type: 'api_call',
  });
}

export default logger;
