import authService from '../services/auth.service.js';
import db from '../database/index.js';
import logger from '../utils/logger.js';

/**
 * GET /api/users
 * List all users
 */
export async function listUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.role_id, u.active, u.last_login_at,
              u.created_at, u.updated_at,
              r.name as role_name, r.description as role_description
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.name ASC`
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      active: row.active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      role: {
        id: row.role_id,
        name: row.role_name,
        description: row.role_description,
      },
    }));

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error('Erro ao listar usuarios:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar usuarios',
    });
  }
}

/**
 * GET /api/users/:id
 * Get user by ID
 */
export async function getUser(req, res) {
  try {
    const { id } = req.params;

    const user = await authService.getUserById(parseInt(id));

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Erro ao obter usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao obter usuario',
    });
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function createUser(req, res) {
  try {
    const { email, password, name, roleId } = req.body;

    // Validation
    if (!email || !password || !name || !roleId) {
      return res.status(400).json({
        success: false,
        error: 'Email, senha, nome e cargo sao obrigatorios',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve ter no minimo 6 caracteres',
      });
    }

    // Check if email already exists
    const existing = await authService.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Email ja cadastrado',
      });
    }

    // Check if role exists
    const roleResult = await db.query('SELECT id FROM roles WHERE id = $1', [roleId]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cargo nao encontrado',
      });
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email.toLowerCase(), passwordHash, name, roleId]
    );

    const newUser = await authService.getUserById(result.rows[0].id);

    logger.info(`Usuario ${email} criado por ${req.user.email}`);

    return res.status(201).json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    logger.error('Erro ao criar usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar usuario',
    });
  }
}

/**
 * PUT /api/users/:id
 * Update user
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { email, password, name, roleId, active } = req.body;

    const userId = parseInt(id);

    // Check if user exists
    const existingUser = await authService.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
    }

    // Prevent changing own role or deactivating self
    if (userId === req.user.id) {
      if (roleId && roleId !== existingUser.role.id) {
        return res.status(400).json({
          success: false,
          error: 'Voce nao pode alterar seu proprio cargo',
        });
      }
      if (active === false) {
        return res.status(400).json({
          success: false,
          error: 'Voce nao pode desativar sua propria conta',
        });
      }
    }

    // Check if email already exists (if changing)
    if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailExists = await authService.getUserByEmail(email);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: 'Email ja cadastrado',
        });
      }
    }

    // Check if role exists (if changing)
    if (roleId) {
      const roleResult = await db.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cargo nao encontrado',
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email.toLowerCase());
    }
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (roleId) {
      updates.push(`role_id = $${paramCount++}`);
      values.push(roleId);
    }
    if (typeof active === 'boolean') {
      updates.push(`active = $${paramCount++}`);
      values.push(active);
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Senha deve ter no minimo 6 caracteres',
        });
      }
      const passwordHash = await authService.hashPassword(password);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
      updates.push(`password_changed_at = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar',
      });
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // If password was changed, revoke all tokens
    if (password) {
      await authService.revokeAllUserTokens(userId);
    }

    const updatedUser = await authService.getUserById(userId);

    logger.info(`Usuario ${existingUser.email} atualizado por ${req.user.email}`);

    return res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    logger.error('Erro ao atualizar usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar usuario',
    });
  }
}

/**
 * DELETE /api/users/:id
 * Delete user (soft delete - set active=false)
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Check if user exists
    const existingUser = await authService.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario nao encontrado',
      });
    }

    // Prevent deleting self
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Voce nao pode excluir sua propria conta',
      });
    }

    // Prevent deleting last admin
    if (existingUser.role.name === 'Admin') {
      const adminCount = await db.query(
        `SELECT COUNT(*) FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'Admin' AND u.active = true`
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Nao e possivel excluir o ultimo administrador',
        });
      }
    }

    // Soft delete - deactivate user
    await db.query('UPDATE users SET active = false WHERE id = $1', [userId]);

    // Revoke all tokens
    await authService.revokeAllUserTokens(userId);

    logger.info(`Usuario ${existingUser.email} excluido por ${req.user.email}`);

    return res.json({
      success: true,
      message: 'Usuario excluido com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao excluir usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao excluir usuario',
    });
  }
}

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
