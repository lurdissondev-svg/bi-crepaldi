#!/usr/bin/env node
/**
 * Script de Migration para PostgreSQL
 * Executa todas as migrations na ordem correta
 *
 * Uso: node src/database/scripts/migrate.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'bi_crepaldi',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function createMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

async function recordMigration(client, name) {
  await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
}

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🗄️  Iniciando migrations...\n');

    // Cria tabela de controle de migrations
    await createMigrationsTable(client);

    // Obtém migrations já executadas
    const executedMigrations = await getExecutedMigrations(client);

    // Lê arquivos de migration
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Nenhuma migration encontrada.');
      return;
    }

    let executed = 0;
    let skipped = 0;

    for (const file of files) {
      if (executedMigrations.includes(file)) {
        console.log(`⏭️  Pulando: ${file} (já executada)`);
        skipped++;
        continue;
      }

      console.log(`📝 Executando: ${file}`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await recordMigration(client, file);
        await client.query('COMMIT');
        console.log(`✅ Sucesso: ${file}\n`);
        executed++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Erro na migration ${file}:`, error.message);
        throw error;
      }
    }

    console.log(`\n🎉 Migrations concluídas!`);
    console.log(`   Executadas: ${executed}`);
    console.log(`   Puladas: ${skipped}`);

  } finally {
    client.release();
    await pool.end();
  }
}

// Executa
runMigrations().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
