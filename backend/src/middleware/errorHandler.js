import logger, { logApiCall } from '../utils/logger.js';

/**
 * Request timing middleware - logs duration of all API requests
 */
export const requestTimer = (req, res, next) => {
  const start = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end to capture timing
  res.end = function(...args) {
    const duration = Date.now() - start;
    const success = res.statusCode < 400;

    logApiCall(
      'API',
      `${req.method} ${req.path}`,
      duration,
      success
    );

    // Call original end
    return originalEnd.apply(this, args);
  };

  next();
};

export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.path,
  });
};

export default { errorHandler, notFoundHandler, requestTimer };
