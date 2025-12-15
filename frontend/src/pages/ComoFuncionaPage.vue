<script setup lang="ts">
import { HelpCircle, Database, RefreshCw, BarChart3, Shield, Zap } from 'lucide-vue-next'
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <div class="p-3 bg-purple-500/20 rounded-lg">
        <HelpCircle class="w-6 h-6 text-purple-500" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-[var(--color-text-primary)]">Como Funciona</h1>
        <p class="text-sm text-[var(--color-text-muted)]">Entenda como o BI Crepaldi funciona</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="card p-6">
        <div class="p-3 bg-blue-500/20 rounded-lg w-fit mb-4">
          <Database class="w-6 h-6 text-blue-500" />
        </div>
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Integração de Dados
        </h3>
        <p class="text-sm text-[var(--color-text-muted)]">
          O sistema integra dados do Bitrix24 CRM e Belle Software para fornecer uma visão completa do negócio.
        </p>
      </div>

      <div class="card p-6">
        <div class="p-3 bg-green-500/20 rounded-lg w-fit mb-4">
          <RefreshCw class="w-6 h-6 text-green-500" />
        </div>
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Sincronização Automática
        </h3>
        <p class="text-sm text-[var(--color-text-muted)]">
          Os dados são sincronizados automaticamente a cada 15 minutos para garantir informações sempre atualizadas.
        </p>
      </div>

      <div class="card p-6">
        <div class="p-3 bg-purple-500/20 rounded-lg w-fit mb-4">
          <BarChart3 class="w-6 h-6 text-purple-500" />
        </div>
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Dashboards Interativos
        </h3>
        <p class="text-sm text-[var(--color-text-muted)]">
          Visualize métricas de faturamento, marketing, comercial, atendimento e pacientes em dashboards interativos.
        </p>
      </div>

      <div class="card p-6">
        <div class="p-3 bg-yellow-500/20 rounded-lg w-fit mb-4">
          <Shield class="w-6 h-6 text-yellow-500" />
        </div>
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Segurança
        </h3>
        <p class="text-sm text-[var(--color-text-muted)]">
          Todos os dados são processados com segurança e armazenados de forma criptografada.
        </p>
      </div>

      <div class="card p-6">
        <div class="p-3 bg-red-500/20 rounded-lg w-fit mb-4">
          <Zap class="w-6 h-6 text-red-500" />
        </div>
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Performance
        </h3>
        <p class="text-sm text-[var(--color-text-muted)]">
          Sistema otimizado com cache inteligente para carregamento rápido mesmo com grandes volumes de dados.
        </p>
      </div>
    </div>

    <div class="card p-6">
      <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Funcionalidades Principais
      </h3>
      <ul class="space-y-3 text-sm text-[var(--color-text-secondary)]">
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Resumo:</strong> Visão geral do faturamento e pacientes novos vs recorrentes</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Faturamento:</strong> Análise detalhada de receitas por período e estabelecimento</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Marketing:</strong> Métricas de leads, conversão e ROI de campanhas</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Comercial:</strong> Vendas por origem, procedimentos e metas</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Atendimento:</strong> Performance dos profissionais e satisfação</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Metas:</strong> Acompanhamento de metas por estabelecimento</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2"></span>
          <span><strong>Pacientes:</strong> Análise de LTV, churn e pacientes inativos</span>
        </li>
      </ul>
    </div>
  </div>
</template>
