import { TabNavigation } from '../components/navigation/TabNavigation';
import { useDashboard } from '../hooks/useDashboard';
import { Target, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';
import { MetaEstabelecimento, MetaInfo } from '../types';

// Formatar moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Componente para barra de progresso das metas
function MetaProgressBar({
  label,
  meta,
  color
}: {
  label: string;
  meta: MetaInfo;
  color: string;
}) {
  const progressPct = Math.min(meta.realidade, 100);
  const isAhead = meta.realidade >= meta.expectativa;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-muted)]">
          {meta.metaValorFormatado}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="relative h-6 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
        {/* Marcador de expectativa */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-text-muted)] z-10"
          style={{ left: `${Math.min(meta.expectativa, 100)}%` }}
        />

        {/* Progresso atual */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${progressPct}%` }}
        />

        {/* Porcentagem no centro */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {meta.realidade.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Info abaixo da barra */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${isAhead ? 'text-green-500' : 'text-yellow-500'}`}>
          {isAhead ? 'Acima da expectativa' : 'Abaixo da expectativa'}
        </span>
        <span className="text-[var(--color-text-muted)]">
          Exp: {meta.expectativa.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// Componente para card de estabelecimento
function EstabelecimentoCard({
  estabelecimento,
  color,
  icon: Icon
}: {
  estabelecimento: MetaEstabelecimento;
  color: string;
  icon: React.ElementType;
}) {
  const colorClasses: Record<string, { bg: string; border: string; gradient: string }> = {
    blue: {
      bg: 'bg-blue-500',
      border: 'border-blue-500/30',
      gradient: 'from-blue-500/20 to-transparent'
    },
    purple: {
      bg: 'bg-purple-500',
      border: 'border-purple-500/30',
      gradient: 'from-purple-500/20 to-transparent'
    },
    pink: {
      bg: 'bg-pink-500',
      border: 'border-pink-500/30',
      gradient: 'from-pink-500/20 to-transparent'
    },
    emerald: {
      bg: 'bg-emerald-500',
      border: 'border-emerald-500/30',
      gradient: 'from-emerald-500/20 to-transparent'
    },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`card border ${colors.border} bg-gradient-to-br ${colors.gradient}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)]">
            {estabelecimento.nome}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Faturado: {estabelecimento.faturamentoAtualFormatado}
          </p>
        </div>
      </div>

      {/* Metas */}
      <div className="space-y-4">
        <MetaProgressBar label="Meta I" meta={estabelecimento.meta1} color={colors.bg} />
        <MetaProgressBar label="Meta II" meta={estabelecimento.meta2} color={colors.bg} />
        <MetaProgressBar label="Meta III" meta={estabelecimento.meta3} color={colors.bg} />
      </div>

      {/* Diária necessária */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Diária Meta I</p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {formatCurrency(estabelecimento.meta1.diaria)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Diária Meta II</p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {formatCurrency(estabelecimento.meta2.diaria)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Diária Meta III</p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {formatCurrency(estabelecimento.meta3.diaria)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetasPage() {
  const { data, loadingStates, revalidatingStates } = useDashboard();

  const isLoading = loadingStates.metas;
  const isRevalidating = revalidatingStates.metas;
  const metas = data.metas;

  // Mostra skeleton enquanto carrega
  if (isLoading && !metas) {
    return (
      <div className="space-y-6">
        <TabNavigation />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TabNavigation />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Quadro de Metas
          </h2>
          {metas?.progressoGeral && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Dia {metas.progressoGeral.diasPassados} de {metas.progressoGeral.totalDias}
              {' '}({metas.progressoGeral.diasRestantes} dias restantes)
            </p>
          )}
        </div>
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* Resumo Geral */}
      {metas?.progressoGeral && (
        <div className="card bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-accent)]/20 border border-[var(--color-primary)]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--color-primary)]">
                <DollarSign size={24} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Faturamento Total do Mês</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {metas.progressoGeral.faturamentoTotalFormatado}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--color-text-muted)]">Expectativa do Período</p>
              <p className="text-lg font-semibold text-[var(--color-primary)]">
                {metas.progressoGeral.expectativaPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Estabelecimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metas?.metaSpa && (
          <EstabelecimentoCard
            estabelecimento={metas.metaSpa}
            color="blue"
            icon={Target}
          />
        )}
        {metas?.metaConvenios && (
          <EstabelecimentoCard
            estabelecimento={metas.metaConvenios}
            color="purple"
            icon={TrendingUp}
          />
        )}
        {metas?.metaBelaLaser && (
          <EstabelecimentoCard
            estabelecimento={metas.metaBelaLaser}
            color="pink"
            icon={Calendar}
          />
        )}
        {metas?.metaNutrologia && (
          <EstabelecimentoCard
            estabelecimento={metas.metaNutrologia}
            color="emerald"
            icon={DollarSign}
          />
        )}
      </div>

      {/* Tabela Resumo das Metas */}
      {metas && (
        <div className="card">
          <h3 className="card-header">Resumo das Metas por Estabelecimento</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Estabelecimento
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Faturado
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Meta I
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Meta II
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                    Meta III
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'metaSpa', data: metas.metaSpa },
                  { key: 'metaConvenios', data: metas.metaConvenios },
                  { key: 'metaBelaLaser', data: metas.metaBelaLaser },
                  { key: 'metaNutrologia', data: metas.metaNutrologia },
                ].map(({ key, data: estab }) => estab && (
                  <tr key={key} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-3 px-4 font-medium text-[var(--color-text-primary)]">
                      {estab.nome}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--color-text-secondary)]">
                      {estab.faturamentoAtualFormatado}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${estab.meta1.realidade >= 100 ? 'text-green-500' : 'text-[var(--color-text-secondary)]'}`}>
                        {estab.meta1.realidade.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${estab.meta2.realidade >= 100 ? 'text-green-500' : 'text-[var(--color-text-secondary)]'}`}>
                        {estab.meta2.realidade.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${estab.meta3.realidade >= 100 ? 'text-green-500' : 'text-[var(--color-text-secondary)]'}`}>
                        {estab.meta3.realidade.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
