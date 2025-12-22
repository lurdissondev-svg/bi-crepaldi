#!/usr/bin/env node
/**
 * Script para testar enriquecimento de clientes
 */

import customerEnrichmentService from '../src/services/customer-enrichment.service.js';
import db from '../src/database/index.js';

async function main() {
  console.log('=== Teste de Enriquecimento de Clientes ===\n');

  try {
    // Estatísticas antes
    console.log('Estatísticas antes do enriquecimento:');
    const statsBefore = await customerEnrichmentService.getDataQualityStats();
    console.log(JSON.stringify(statsBefore, null, 2));

    // Executa enriquecimento (dry-run primeiro)
    console.log('\n--- Executando dry-run ---');
    const dryRunResult = await customerEnrichmentService.runEnrichment({
      limit: 20,
      dryRun: true,
    });
    console.log('Resultado dry-run:');
    console.log(JSON.stringify(dryRunResult, null, 2));

    // Executa enriquecimento real
    console.log('\n--- Executando enriquecimento real ---');
    const result = await customerEnrichmentService.runEnrichment({
      limit: 20,
      dryRun: false,
    });
    console.log('Resultado:');
    console.log(JSON.stringify(result, null, 2));

    // Estatísticas depois
    console.log('\nEstatísticas após o enriquecimento:');
    const statsAfter = await customerEnrichmentService.getDataQualityStats();
    console.log(JSON.stringify(statsAfter, null, 2));

    // Histórico de enriquecimentos
    console.log('\nHistórico de enriquecimentos:');
    const history = await customerEnrichmentService.getEnrichmentHistory(10);
    if (history.length > 0) {
      history.forEach(h => {
        console.log(`  - Cliente ${h.cod_cliente}: ${h.field_name} = "${h.new_value}" (fonte: ${h.source})`);
      });
    } else {
      console.log('  Nenhum enriquecimento realizado');
    }

    console.log('\n=== Teste concluído ===');
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
