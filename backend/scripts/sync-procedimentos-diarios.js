#!/usr/bin/env node
/**
 * Script para sincronizar procedimentos diários manualmente
 * Executa apenas a função syncProcedimentosDiarios do sync.service.js
 */

import 'dotenv/config';
import syncService from '../src/services/sync.service.js';

async function main() {
  console.log('🔄 Iniciando sincronização de procedimentos diários...\n');

  try {
    await syncService.syncProcedimentosDiarios();
    console.log('\n✅ Sincronização concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro na sincronização:', error.message);
    process.exit(1);
  }
}

main();
