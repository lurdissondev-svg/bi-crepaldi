import authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha sao obrigatorios',
      });
    }

    // Find user by email
    const user = await authService.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: 'Usuario inativo. Entre em contato com o administrador.',
      });
    }

    // Verify password
    const isValid = await authService.verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais invalidas',
      });
    }

    // Generate tokens
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(user);

    // Update last login
    await authService.updateLastLogin(user.id);

    // Get full user data with permissions
    const userData = await authService.getUserById(user.id);

    logger.info(`Usuario ${user.email} fez login`);

    return res.json({
      success: true,
      data: {
        user: userData,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Erro no login:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar login',
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    logger.info(`Usuario ${req.user.email} fez logout`);

    return res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    logger.error('Erro no logout:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar logout',
    });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token e obrigatorio',
      });
    }

    // Validate refresh token
    const user = await authService.validateRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token invalido ou expirado',
      });
    }

    // Generate new access token
    const accessToken = authService.generateAccessToken(user);

    return res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    logger.error('Erro ao refresh token:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar refresh',
    });
  }
}

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function me(req, res) {
  try {
    return res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    logger.error('Erro ao obter usuario atual:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno',
    });
  }
}

/**
 * POST /api/auth/change-password
 * Change user password
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual e nova senha sao obrigatorias',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter no minimo 6 caracteres',
      });
    }

    // Get current user with password hash
    const user = await authService.getUserByEmail(req.user.email);

    // Verify current password
    const isValid = await authService.verifyPassword(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Senha atual incorreta',
      });
    }

    // Hash new password
    const newHash = await authService.hashPassword(newPassword);

    // Update password in database
    const db = (await import('../database/index.js')).default;
    await db.query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
      [newHash, req.user.id]
    );

    // Revoke all refresh tokens (logout from all devices)
    await authService.revokeAllUserTokens(req.user.id);

    logger.info(`Usuario ${req.user.email} alterou a senha`);

    return res.json({
      success: true,
      message: 'Senha alterada com sucesso. Faca login novamente.',
    });
  } catch (error) {
    logger.error('Erro ao alterar senha:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao alterar senha',
    });
  }
}

export default {
  login,
  logout,
  refresh,
  me,
  changePassword,
};
