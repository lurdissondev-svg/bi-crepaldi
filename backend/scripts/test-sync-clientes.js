#!/usr/bin/env node
/**
 * Script para testar sync de clientes
 * Executa: node scripts/test-sync-clientes.js
 */

import syncService from '../src/services/sync.service.js';
import db from '../src/database/index.js';

async function main() {
  console.log('=== Teste de Sync de Clientes ===\n');

  try {
    // Verifica conexão com banco
    const health = await db.healthCheck();
    console.log('Banco de dados:', health.connected ? 'Conectado' : 'Erro');

    if (!health.connected) {
      console.error('Não foi possível conectar ao banco de dados');
      process.exit(1);
    }

    // Conta clientes antes
    const before = await db.query('SELECT COUNT(*) as total FROM clientes');
    console.log(`\nClientes antes: ${before.rows[0].total}`);

    // Executa sync
    console.log('\nIniciando sync de clientes...');
    const result = await syncService.syncClientes();

    // Conta clientes depois
    const after = await db.query('SELECT COUNT(*) as total FROM clientes');
    console.log(`\nClientes depois: ${after.rows[0].total}`);

    // Mostra estatísticas
    if (result) {
      console.log('\nResultado:');
      console.log(`  - Buscados: ${result.fetched}`);
      console.log(`  - Inseridos: ${result.inserted}`);
      console.log(`  - Atualizados: ${result.updated}`);
    }

    // Mostra amostra de clientes com dados faltantes
    const missing = await db.query(`
      SELECT cod_cliente, nome, telefone, celular, email
      FROM clientes
      WHERE (telefone IS NULL OR telefone = '')
         OR (celular IS NULL OR celular = '')
         OR (email IS NULL OR email = '')
      LIMIT 5
    `);

    if (missing.rows.length > 0) {
      console.log('\nExemplos de clientes com dados faltantes:');
      missing.rows.forEach(c => {
        console.log(`  - ${c.nome} (${c.cod_cliente}): tel=${c.telefone || '(vazio)'}, cel=${c.celular || '(vazio)'}, email=${c.email || '(vazio)'}`);
      });
    }

    console.log('\n=== Sync concluído ===');
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
