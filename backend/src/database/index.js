import pg from 'pg';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

// Pool de conexões
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolSize,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log de conexão
pool.on('connect', () => {
  logger.debug('Nova conexão estabelecida com PostgreSQL');
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool PostgreSQL:', err);
});

/**
 * Executa uma query simples
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Query lenta detectada', { text: text.substring(0, 100), duration });
    }

    return result;
  } catch (error) {
    logger.error('Erro na query:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

/**
 * Obtém um cliente do pool para transações
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Timeout para liberação automática
  const timeout = setTimeout(() => {
    logger.warn('Cliente PostgreSQL não liberado após 30s');
  }, 30000);

  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };

  return client;
}

/**
 * Executa queries em uma transação
 * @param {Function} callback - Função que recebe o client
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insere múltiplos registros com upsert
 * @param {string} table - Nome da tabela
 * @param {Array<Object>} records - Registros a inserir
 * @param {string} conflictColumn - Coluna para ON CONFLICT
 * @param {Array<string>} updateColumns - Colunas a atualizar no conflito
 * @returns {Promise<{inserted: number, updated: number}>}
 */
export async function upsertMany(table, records, conflictColumn, updateColumns = []) {
  if (!records || records.length === 0) return { inserted: 0, updated: 0 };

  const columns = Object.keys(records[0]);
  const values = records.map(record => columns.map(col => record[col]));

  // Gera placeholders ($1, $2, etc.)
  let paramIndex = 1;
  const valuePlaceholders = values.map(row => {
    const placeholders = row.map(() => `$${paramIndex++}`);
    return `(${placeholders.join(', ')})`;
  }).join(', ');

  // Gera ON CONFLICT UPDATE
  let onConflict = '';
  if (conflictColumn) {
    if (updateColumns.length > 0) {
      const updates = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
      onConflict = `ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP`;
    } else {
      onConflict = `ON CONFLICT (${conflictColumn}) DO NOTHING`;
    }
  }

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${valuePlaceholders}
    ${onConflict}
    RETURNING (xmax = 0) AS inserted
  `;

  const flatValues = values.flat();
  const result = await query(sql, flatValues);

  const inserted = result.rows.filter(r => r.inserted).length;
  const updated = result.rows.filter(r => !r.inserted).length;

  return { inserted, updated };
}

/**
 * Verifica conexão com o banco
 * @returns {Promise<{connected: boolean, message: string}>}
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as time, current_database() as db');
    return {
      connected: true,
      message: `Conectado a ${result.rows[0].db}`,
      timestamp: result.rows[0].time,
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message,
      timestamp: null,
    };
  }
}

/**
 * Fecha o pool de conexões
 */
export async function close() {
  await pool.end();
  logger.info('Pool PostgreSQL encerrado');
}

export default {
  query,
  getClient,
  transaction,
  upsertMany,
  healthCheck,
  close,
  pool,
};
