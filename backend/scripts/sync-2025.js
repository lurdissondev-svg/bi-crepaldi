/**
 * Script para sincronizar todos os dados de 2025
 * Executa: node scripts/sync-2025.js
 */

import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import db from '../src/database/index.js';
import bitrix24Service from '../src/services/bitrix24.service.js';
import belleService from '../src/services/belle.service.js';
import config from '../src/config/index.js';

const ESTABELECIMENTOS = config.belle.estabelecimentos;
const DELAY_BETWEEN_REQUESTS = 3000; // 3 segundos entre requisições
const RETRY_DELAY = 10000; // 10 segundos antes de retry
const MAX_RETRIES = 3;

// Função auxiliar para delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função com retry automático
async function withRetry(fn, context, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = error.message?.includes('503') ||
                          error.message?.includes('429') ||
                          error.message?.includes('timeout');

      if (isRetryable && i < retries - 1) {
        console.log(`[Retry ${i + 1}/${retries}] ${context} - Aguardando ${RETRY_DELAY/1000}s...`);
        await sleep(RETRY_DELAY * (i + 1)); // Backoff exponencial
        continue;
      }
      throw error;
    }
  }
}

async function syncLeadsForPeriod(startDate, endDate) {
  console.log(`[Leads] Buscando de ${startDate} a ${endDate}...`);

  const leads = await withRetry(
    () => bitrix24Service.getLeadsByDateRange(startDate, endDate),
    `Leads ${startDate} a ${endDate}`
  );
  console.log(`[Leads] Encontrados: ${leads.length}`);

  if (leads.length === 0) return { inserted: 0, updated: 0 };

  const records = leads.map(lead => ({
    bitrix_id: parseInt(lead.ID),
    titulo: lead.TITLE || null,
    nome: lead.NAME || null,
    sobrenome: lead.LAST_NAME || null,
    status_id: lead.STATUS_ID || null,
    source_id: lead.SOURCE_ID || null,
    source_description: lead.SOURCE_DESCRIPTION || null,
    telefones: JSON.stringify(extractPhones(lead)),
    emails: JSON.stringify(extractEmails(lead)),
    empresa: lead.COMPANY_TITLE || null,
    utm_source: lead.UTM_SOURCE || null,
    utm_medium: lead.UTM_MEDIUM || null,
    utm_campaign: lead.UTM_CAMPAIGN || null,
    utm_content: lead.UTM_CONTENT || null,
    utm_term: lead.UTM_TERM || null,
    opportunity: parseFloat(lead.OPPORTUNITY) || 0,
    currency_id: lead.CURRENCY_ID || 'BRL',
    assigned_by_id: parseInt(lead.ASSIGNED_BY_ID) || null,
    bitrix_created_at: lead.DATE_CREATE || null,
    bitrix_modified_at: lead.DATE_MODIFY || null,
    bitrix_closed_at: lead.DATE_CLOSED || null,
    custom_fields: JSON.stringify(extractCustomFields(lead)),
    synced_at: new Date().toISOString(),
  }));

  return await upsertRecords('leads', records, 'bitrix_id');
}

async function syncDealsForPeriod(startDate, endDate) {
  console.log(`[Deals] Buscando de ${startDate} a ${endDate}...`);

  const deals = await withRetry(
    () => bitrix24Service.getDealsByDateRange(startDate, endDate),
    `Deals ${startDate} a ${endDate}`
  );
  console.log(`[Deals] Encontrados: ${deals.length}`);

  if (deals.length === 0) return { inserted: 0, updated: 0 };

  const records = deals.map(deal => ({
    bitrix_id: parseInt(deal.ID),
    titulo: deal.TITLE || null,
    stage_id: deal.STAGE_ID || null,
    category_id: parseInt(deal.CATEGORY_ID) || 0,
    opportunity: parseFloat(deal.OPPORTUNITY) || 0,
    currency_id: deal.CURRENCY_ID || 'BRL',
    contact_id: parseInt(deal.CONTACT_ID) || null,
    company_id: parseInt(deal.COMPANY_ID) || null,
    source_id: deal.SOURCE_ID || null,
    assigned_by_id: parseInt(deal.ASSIGNED_BY_ID) || null,
    utm_source: deal.UTM_SOURCE || null,
    utm_medium: deal.UTM_MEDIUM || null,
    utm_campaign: deal.UTM_CAMPAIGN || null,
    utm_content: deal.UTM_CONTENT || null,
    utm_term: deal.UTM_TERM || null,
    bitrix_created_at: deal.DATE_CREATE || null,
    bitrix_modified_at: deal.DATE_MODIFY || null,
    close_date: deal.CLOSEDATE || null,
    custom_fields: JSON.stringify(extractCustomFields(deal)),
    synced_at: new Date().toISOString(),
  }));

  return await upsertRecords('deals', records, 'bitrix_id');
}

async function syncContasReceberForPeriod(startDate, endDate) {
  console.log(`[Contas Receber] Buscando de ${startDate} a ${endDate}...`);

  const results = await Promise.all(
    ESTABELECIMENTOS.map(async (codEstab) => {
      try {
        // Ordem correta: codEstab, dataInicio, dataFim
        const data = await belleService.getContasReceber(codEstab, startDate, endDate);
        return { codestab: codEstab, dados: data.dados || data || [] };
      } catch (error) {
        console.warn(`[Contas Receber] Erro estab ${codEstab}:`, error.message);
        return { codestab: codEstab, dados: [] };
      }
    })
  );

  const allRecords = [];
  for (const resultado of results) {
    const dados = resultado.dados || [];
    console.log(`[Contas Receber] Estab ${resultado.codestab}: ${dados.length} registros`);

    const records = dados.map(conta => ({
      cod_conta: parseInt(conta.cod_movimento) || 0,
      cod_estab: resultado.codestab,
      cod_cliente: parseInt(conta.cod_cliente) || null,
      cod_venda: parseInt(conta.id_venda_relacionada) || null,
      valor_bruto: parseFloat(conta.valor_bruto) || 0,
      valor_liquido: parseFloat(conta.valor_liquido) || 0,
      valor_desconto: parseFloat(conta.valor_desconto) || 0,
      cod_forma_pagamento: parseInt(conta.cod_forma_pagamento) || null,
      nome_forma_pagamento: conta.nome_forma_pagamento || null,
      dt_lancamento: conta.dt_lancamento || null,
      dt_vencimento: conta.dt_vencimento || null,
      dt_pagamento: conta.dt_pagamento || null,
      confirmado: conta.confirmado || 'N',
      observacao: conta.observacao || null,
      synced_at: new Date().toISOString(),
    }));

    allRecords.push(...records);
  }

  if (allRecords.length === 0) return { inserted: 0, updated: 0 };
  return await upsertRecords('contas_receber', allRecords, 'cod_conta');
}

async function syncVendasForPeriod(startDate, endDate) {
  console.log(`[Vendas] Buscando de ${startDate} a ${endDate}...`);

  const results = await Promise.all(
    ESTABELECIMENTOS.map(async (codEstab) => {
      try {
        // Ordem correta: codEstab, dataInicio, dataFim
        const result = await belleService.getVendas(codEstab, startDate, endDate);
        return { codestab: codEstab, vendas: result.data || [] };
      } catch (error) {
        console.warn(`[Vendas] Erro estab ${codEstab}:`, error.message);
        return { codestab: codEstab, vendas: [] };
      }
    })
  );

  const allRecords = [];
  for (const resultado of results) {
    const vendas = resultado.vendas || [];
    console.log(`[Vendas] Estab ${resultado.codestab}: ${vendas.length} registros`);

    const records = vendas.map(venda => ({
      cod_venda: parseInt(venda.id_venda) || 0,
      cod_estab: resultado.codestab,
      cod_cliente: parseInt(venda.cod_cliente) || null,
      valor_venda: parseFloat(venda.valor_venda) || 0,
      valor_desconto: parseFloat(venda.valor_desconto) || 0,
      valor_liquido: parseFloat(venda.valor_liquido) || parseFloat(venda.valor_venda) || 0,
      data_venda: venda.data_venda || null,
      cod_profissional: parseInt(venda.cod_profissional) || null,
      nome_profissional: venda.nome_profissional || null,
      status: venda.itens_venda?.[0]?.status || null,
      confirmado: 'S',
      synced_at: new Date().toISOString(),
    }));

    allRecords.push(...records);
  }

  if (allRecords.length === 0) return { inserted: 0, updated: 0 };
  return await upsertRecords('vendas', allRecords, 'cod_venda');
}

// Helper functions
function extractPhones(entity) {
  if (!entity.PHONE) return [];
  return entity.PHONE.map(p => p.VALUE).filter(Boolean);
}

function extractEmails(entity) {
  if (!entity.EMAIL) return [];
  return entity.EMAIL.map(e => e.VALUE).filter(Boolean);
}

function extractCustomFields(entity) {
  const custom = {};
  Object.keys(entity).forEach(key => {
    if (key.startsWith('UF_')) {
      custom[key] = entity[key];
    }
  });
  return custom;
}

async function upsertRecords(tableName, records, conflictColumn) {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  const BATCH_SIZE = 100; // Processar 100 registros por vez
  let totalProcessed = 0;

  const columns = Object.keys(records[0]);
  const updateColumns = columns.filter(c => c !== conflictColumn);
  const updateSet = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');

  // Processar em batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const values = batch.map((record, idx) => {
      const placeholders = columns.map((_, j) => `$${idx * columns.length + j + 1}`);
      return `(${placeholders.join(', ')})`;
    });

    const flatValues = batch.flatMap(record => columns.map(col => record[col]));

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateSet}
    `;

    try {
      await db.query(query, flatValues);
      totalProcessed += batch.length;
    } catch (err) {
      console.error(`Erro no batch ${i}-${i + batch.length}:`, err.message);
    }
  }

  return { inserted: totalProcessed, updated: 0 };
}

async function main() {
  console.log('='.repeat(60));
  console.log('SYNC COMPLETO DE 2025');
  console.log('='.repeat(60));

  const startYear = new Date(2025, 0, 1); // 01/01/2025
  const today = new Date();

  let totalLeads = 0;
  let totalDeals = 0;
  let totalContas = 0;
  let totalVendas = 0;

  // Processar mês a mês
  let currentMonth = startYear;
  while (currentMonth <= today) {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    console.log('\n' + '-'.repeat(40));
    console.log(`Processando: ${format(currentMonth, 'MMMM yyyy')}`);
    console.log('-'.repeat(40));

    try {
      // Leads
      const leadsResult = await syncLeadsForPeriod(monthStart, monthEnd);
      totalLeads += leadsResult.inserted;
      await sleep(DELAY_BETWEEN_REQUESTS);

      // Deals
      const dealsResult = await syncDealsForPeriod(monthStart, monthEnd);
      totalDeals += dealsResult.inserted;
      await sleep(DELAY_BETWEEN_REQUESTS);

      // Contas Receber
      const contasResult = await syncContasReceberForPeriod(monthStart, monthEnd);
      totalContas += contasResult.inserted;
      await sleep(DELAY_BETWEEN_REQUESTS);

      // Vendas
      const vendasResult = await syncVendasForPeriod(monthStart, monthEnd);
      totalVendas += vendasResult.inserted;

      console.log(`[OK] Mês ${format(currentMonth, 'MM/yyyy')} processado!`);
    } catch (error) {
      console.error(`[ERRO] Mês ${format(currentMonth, 'MM/yyyy')}:`, error.message);
    }

    // Delay maior entre meses para evitar rate limiting
    await sleep(5000);
    currentMonth = addMonths(currentMonth, 1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Leads sincronizados: ${totalLeads}`);
  console.log(`Deals sincronizados: ${totalDeals}`);
  console.log(`Contas a Receber sincronizadas: ${totalContas}`);
  console.log(`Vendas sincronizadas: ${totalVendas}`);

  await db.end();
  console.log('\nSync completo!');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
