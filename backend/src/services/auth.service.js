import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import db from '../database/index.js';
import logger from '../utils/logger.js';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate an access token (short-lived)
 */
export function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    roleId: user.role_id,
    roleName: user.role_name,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTokenExpiry,
  });
}

/**
 * Generate a refresh token (long-lived) and store in database
 */
export async function generateRefreshToken(user) {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return token;
}

/**
 * Validate a refresh token and return the associated user
 */
export async function validateRefreshToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await db.query(
    `SELECT rt.*, u.id as user_id, u.email, u.name, u.role_id, u.active,
            r.name as role_name
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     JOIN roles r ON u.role_id = r.id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row.active) {
    // User is inactive, revoke the token
    await revokeRefreshToken(token);
    return null;
  }

  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    role_id: row.role_id,
    role_name: row.role_name,
  };
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await db.query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash]
  );
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId) {
  await db.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1',
    [userId]
  );
}

/**
 * Clean up expired refresh tokens (call periodically)
 */
export async function cleanupExpiredTokens() {
  const result = await db.query(
    'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
  );

  if (result.rowCount > 0) {
    logger.debug(`Cleaned up ${result.rowCount} expired refresh tokens`);
  }
}

/**
 * Verify an access token and return the payload
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
}

/**
 * Get user by ID with role information
 */
export async function getUserById(userId) {
  const result = await db.query(
    `SELECT u.id, u.email, u.name, u.role_id, u.active, u.last_login_at,
            u.created_at, u.updated_at,
            r.name as role_name, r.description as role_description, r.is_system_role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  // Get permissions for the user's role
  const permissionsResult = await db.query(
    `SELECT page_slug, can_view
     FROM role_permissions
     WHERE role_id = $1`,
    [user.role_id]
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    role: {
      id: user.role_id,
      name: user.role_name,
      description: user.role_description,
      isSystemRole: user.is_system_role,
      permissions: permissionsResult.rows.map(p => ({
        pageSlug: p.page_slug,
        canView: p.can_view,
      })),
    },
  };
}

/**
 * Get user by email (for login)
 */
export async function getUserByEmail(email) {
  const result = await db.query(
    `SELECT u.*, r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );

  return result.rows[0] || null;
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId) {
  await db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [userId]
  );
}

export default {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  verifyAccessToken,
  getUserById,
  getUserByEmail,
  updateLastLogin,
};
