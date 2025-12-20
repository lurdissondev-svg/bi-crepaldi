#!/usr/bin/env node
/**
 * Script rápido para testar sync de clientes
 * Sincroniza apenas 1 página (100 clientes) do primeiro estabelecimento
 */

import belleService from '../src/services/belle.service.js';
import db from '../src/database/index.js';

async function main() {
  console.log('=== Teste Rápido de Sync de Clientes ===\n');

  try {
    // Verifica conexão
    const health = await db.healthCheck();
    console.log('Banco:', health.connected ? 'OK' : 'ERRO');

    // Pega primeiro estabelecimento
    const estabResult = await db.query(`
      SELECT cod_estab, nome FROM estabelecimentos WHERE ativo = true LIMIT 1
    `);

    if (estabResult.rows.length === 0) {
      console.log('Nenhum estabelecimento encontrado');
      process.exit(1);
    }

    const estab = estabResult.rows[0];
    console.log(`\nEstabelecimento: ${estab.nome} (${estab.cod_estab})`);

    // Busca apenas 1 página de clientes
    console.log('\nBuscando clientes da API Belle (1 página)...');
    const clientes = await belleService.getClientes(estab.cod_estab, 0);

    console.log(`Clientes recebidos: ${clientes?.length || 0}`);

    if (!clientes || clientes.length === 0) {
      console.log('Nenhum cliente retornado pela API');
      process.exit(0);
    }

    // Mostra estrutura do primeiro cliente
    console.log('\nEstrutura do primeiro cliente:');
    console.log(JSON.stringify(clientes[0], null, 2));

    // Insere clientes no banco
    console.log('\nInserindo clientes no banco...');
    let inserted = 0;
    let errors = 0;

    for (const cliente of clientes.slice(0, 20)) { // Só os primeiros 20
      try {
        // API Belle retorna 'codigo' como ID do cliente
        const codCliente = parseInt(cliente.codigo) || parseInt(cliente.cod_cliente) || parseInt(cliente.id);
        if (!codCliente || isNaN(codCliente)) {
          console.log(`  Skip: cliente sem código válido`);
          continue;
        }
        const nome = cliente.nome || cliente.razao_social || `Cliente ${codCliente}`;

        await db.query(`
          INSERT INTO clientes (cod_cliente, cod_estab, nome, telefone, celular, email, synced_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (cod_cliente, cod_estab) DO UPDATE SET
            nome = EXCLUDED.nome,
            telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), clientes.telefone),
            celular = COALESCE(NULLIF(EXCLUDED.celular, ''), clientes.celular),
            email = COALESCE(NULLIF(EXCLUDED.email, ''), clientes.email),
            synced_at = NOW()
        `, [
          codCliente,
          estab.cod_estab,
          nome,
          cliente.telefone || cliente.fone || null,
          cliente.celular || cliente.fone_celular || null,
          cliente.email || null,
        ]);
        inserted++;
      } catch (error) {
        errors++;
        console.log(`  Erro: ${error.message}`);
      }
    }

    console.log(`\nInseridos: ${inserted}, Erros: ${errors}`);

    // Verifica clientes no banco
    const countResult = await db.query('SELECT COUNT(*) as total FROM clientes');
    console.log(`\nTotal de clientes no banco: ${countResult.rows[0].total}`);

    // Mostra amostra
    const sampleResult = await db.query(`
      SELECT cod_cliente, nome, telefone, celular, email
      FROM clientes LIMIT 5
    `);

    console.log('\nAmostra de clientes:');
    sampleResult.rows.forEach(c => {
      console.log(`  - ${c.nome}: tel=${c.telefone || '-'}, cel=${c.celular || '-'}, email=${c.email || '-'}`);
    });

    console.log('\n=== Teste concluído ===');
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
