import authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticacao nao fornecido',
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Token invalido ou expirado',
      });
    }

    // Get full user data
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: 'Usuario inativo',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Erro na verificacao do token:', error);
    return res.status(401).json({
      success: false,
      error: 'Erro na autenticacao',
    });
  }
}

/**
 * Middleware to check if user has permission to access a specific page
 */
export function requirePermission(pageSlug) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Usuario nao autenticado',
        });
      }

      // Admin and Diretor always have full access
      if (['Admin', 'Diretor'].includes(req.user.role.name)) {
        return next();
      }

      // Check if user's role has permission for this page
      const permission = req.user.role.permissions.find(
        (p) => p.pageSlug === pageSlug
      );

      if (!permission || !permission.canView) {
        return res.status(403).json({
          success: false,
          error: 'Voce nao tem permissao para acessar esta pagina',
        });
      }

      next();
    } catch (error) {
      logger.error('Erro na verificacao de permissao:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissoes',
      });
    }
  };
}

/**
 * Middleware to restrict access to specific roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario nao autenticado',
      });
    }

    if (!allowedRoles.includes(req.user.role.name)) {
      return res.status(403).json({
        success: false,
        error: 'Voce nao tem permissao para esta acao',
      });
    }

    next();
  };
}

/**
 * Optional authentication - populates req.user if token is present but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyAccessToken(token);

    if (payload) {
      const user = await authService.getUserById(payload.userId);
      if (user && user.active) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
}

export default {
  verifyToken,
  requirePermission,
  requireRole,
  optionalAuth,
};
