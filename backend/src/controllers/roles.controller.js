import db from '../database/index.js';
import logger from '../utils/logger.js';

// Available pages in the system
const AVAILABLE_PAGES = [
  { slug: 'resumo', name: 'Resumo', description: 'Dashboard principal com KPIs' },
  { slug: 'faturamento', name: 'Faturamento', description: 'Analise de receita e faturamento' },
  { slug: 'marketing', name: 'Marketing', description: 'Metricas de leads e campanhas' },
  { slug: 'comercial', name: 'Comercial', description: 'Conversoes e vendas por origem' },
  { slug: 'atendimento', name: 'Atendimento', description: 'Performance por profissional' },
  { slug: 'metas', name: 'Metas', description: 'Acompanhamento de metas mensais' },
  { slug: 'pacientes', name: 'Pacientes', description: 'Analise de pacientes e retencao' },
  { slug: 'meta-ads', name: 'Meta Ads', description: 'Configuracao de integracao Meta' },
  { slug: 'como-funciona', name: 'Como Funciona', description: 'Documentacao do sistema' },
  { slug: 'usuarios', name: 'Usuarios', description: 'Gerenciamento de usuarios e cargos' },
];

/**
 * GET /api/roles
 * List all roles with their permissions
 */
export async function listRoles(req, res) {
  try {
    const rolesResult = await db.query(
      `SELECT id, name, description, is_system_role, created_at, updated_at
       FROM roles
       ORDER BY id ASC`
    );

    const roles = [];

    for (const role of rolesResult.rows) {
      const permissionsResult = await db.query(
        `SELECT page_slug, can_view
         FROM role_permissions
         WHERE role_id = $1`,
        [role.id]
      );

      // Count users with this role
      const usersCount = await db.query(
        'SELECT COUNT(*) FROM users WHERE role_id = $1 AND active = true',
        [role.id]
      );

      roles.push({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystemRole: role.is_system_role,
        usersCount: parseInt(usersCount.rows[0].count),
        createdAt: role.created_at,
        updatedAt: role.updated_at,
        permissions: permissionsResult.rows.map((p) => ({
          pageSlug: p.page_slug,
          canView: p.can_view,
        })),
      });
    }

    return res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    logger.error('Erro ao listar cargos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar cargos',
    });
  }
}

/**
 * GET /api/roles/pages
 * List all available pages for permissions
 */
export async function listPages(req, res) {
  try {
    return res.json({
      success: true,
      data: AVAILABLE_PAGES,
    });
  } catch (error) {
    logger.error('Erro ao listar paginas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar paginas',
    });
  }
}

/**
 * GET /api/roles/:id
 * Get role by ID with permissions
 */
export async function getRole(req, res) {
  try {
    const { id } = req.params;

    const roleResult = await db.query(
      `SELECT id, name, description, is_system_role, created_at, updated_at
       FROM roles WHERE id = $1`,
      [id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargo nao encontrado',
      });
    }

    const role = roleResult.rows[0];

    const permissionsResult = await db.query(
      `SELECT page_slug, can_view
       FROM role_permissions
       WHERE role_id = $1`,
      [role.id]
    );

    return res.json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystemRole: role.is_system_role,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
        permissions: permissionsResult.rows.map((p) => ({
          pageSlug: p.page_slug,
          canView: p.can_view,
        })),
      },
    });
  } catch (error) {
    logger.error('Erro ao obter cargo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao obter cargo',
    });
  }
}

/**
 * POST /api/roles
 * Create a new role
 */
export async function createRole(req, res) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nome do cargo e obrigatorio',
      });
    }

    // Check if name already exists
    const existing = await db.query(
      'SELECT id FROM roles WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ja existe um cargo com este nome',
      });
    }

    // Create role
    const result = await db.query(
      `INSERT INTO roles (name, description, is_system_role)
       VALUES ($1, $2, false)
       RETURNING id`,
      [name, description || '']
    );

    const roleId = result.rows[0].id;

    // Create default permissions (all false)
    for (const page of AVAILABLE_PAGES) {
      await db.query(
        `INSERT INTO role_permissions (role_id, page_slug, can_view)
         VALUES ($1, $2, false)`,
        [roleId, page.slug]
      );
    }

    logger.info(`Cargo ${name} criado por ${req.user.email}`);

    // Return created role
    const roleResult = await db.query(
      'SELECT * FROM roles WHERE id = $1',
      [roleId]
    );

    const permissionsResult = await db.query(
      'SELECT page_slug, can_view FROM role_permissions WHERE role_id = $1',
      [roleId]
    );

    return res.status(201).json({
      success: true,
      data: {
        id: roleResult.rows[0].id,
        name: roleResult.rows[0].name,
        description: roleResult.rows[0].description,
        isSystemRole: roleResult.rows[0].is_system_role,
        permissions: permissionsResult.rows.map((p) => ({
          pageSlug: p.page_slug,
          canView: p.can_view,
        })),
      },
    });
  } catch (error) {
    logger.error('Erro ao criar cargo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar cargo',
    });
  }
}

/**
 * PUT /api/roles/:id
 * Update role name and description
 */
export async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [id]);

    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargo nao encontrado',
      });
    }

    const role = roleResult.rows[0];

    // Cannot change name of system roles
    if (role.is_system_role && name && name !== role.name) {
      return res.status(400).json({
        success: false,
        error: 'Nao e possivel alterar o nome de cargos do sistema',
      });
    }

    // Check if new name already exists
    if (name && name.toLowerCase() !== role.name.toLowerCase()) {
      const existing = await db.query(
        'SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Ja existe um cargo com este nome',
        });
      }
    }

    // Update role
    await db.query(
      `UPDATE roles SET
        name = COALESCE($1, name),
        description = COALESCE($2, description)
       WHERE id = $3`,
      [role.is_system_role ? role.name : name, description, id]
    );

    logger.info(`Cargo ${role.name} atualizado por ${req.user.email}`);

    // Return updated role
    return getRole(req, res);
  } catch (error) {
    logger.error('Erro ao atualizar cargo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar cargo',
    });
  }
}

/**
 * PUT /api/roles/:id/permissions
 * Update role permissions
 */
export async function updatePermissions(req, res) {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissoes sao obrigatorias',
      });
    }

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [id]);

    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargo nao encontrado',
      });
    }

    // Update permissions
    for (const perm of permissions) {
      const { pageSlug, canView } = perm;

      // Validate page slug
      if (!AVAILABLE_PAGES.find((p) => p.slug === pageSlug)) {
        continue; // Skip invalid pages
      }

      await db.query(
        `INSERT INTO role_permissions (role_id, page_slug, can_view)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, page_slug)
         DO UPDATE SET can_view = $3`,
        [id, pageSlug, canView]
      );
    }

    logger.info(`Permissoes do cargo ${roleResult.rows[0].name} atualizadas por ${req.user.email}`);

    // Return updated role
    return getRole(req, res);
  } catch (error) {
    logger.error('Erro ao atualizar permissoes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar permissoes',
    });
  }
}

/**
 * DELETE /api/roles/:id
 * Delete a role (non-system roles only)
 */
export async function deleteRole(req, res) {
  try {
    const { id } = req.params;

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [id]);

    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargo nao encontrado',
      });
    }

    const role = roleResult.rows[0];

    // Cannot delete system roles
    if (role.is_system_role) {
      return res.status(400).json({
        success: false,
        error: 'Nao e possivel excluir cargos do sistema',
      });
    }

    // Check if there are users with this role
    const usersCount = await db.query(
      'SELECT COUNT(*) FROM users WHERE role_id = $1',
      [id]
    );
    if (parseInt(usersCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Existem usuarios com este cargo. Remova os usuarios primeiro.',
      });
    }

    // Delete role (permissions will cascade)
    await db.query('DELETE FROM roles WHERE id = $1', [id]);

    logger.info(`Cargo ${role.name} excluido por ${req.user.email}`);

    return res.json({
      success: true,
      message: 'Cargo excluido com sucesso',
    });
  } catch (error) {
    logger.error('Erro ao excluir cargo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao excluir cargo',
    });
  }
}

export default {
  listRoles,
  listPages,
  getRole,
  createRole,
  updateRole,
  updatePermissions,
  deleteRole,
};
