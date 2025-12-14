import { useState, useEffect } from 'react';
import { ProgressBar } from '../components/dashboard/ProgressBar';
import { useDashboard } from '../hooks/useDashboard';
import { AlertTriangle } from 'lucide-react';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';

export function MetasPage() {
  const { data, loadingStates, revalidatingStates } = useDashboard();

  // Use specific loading state for metas
  const isLoading = loadingStates.metas;
  const isRevalidating = revalidatingStates.metas;

  const [metas, setMetas] = useState({
    spa: {
      meta1: { expectativa: 43.48, realidade: null as number | null, diaria: null as number | null },
      meta2: { expectativa: 43.48, realidade: null as number | null, diaria: null as number | null },
      meta3: { expectativa: 43.48, realidade: null as number | null, diaria: null as number | null },
    },
  });

  useEffect(() => {
    if (data.metas?.metaSpa) {
      setMetas({ spa: data.metas.metaSpa });
    }
  }, [data.metas]);

  const renderMetaCard = (
    title: string,
    expectativa: number,
    _realidade: number | null,
    _diaria: number | null
  ) => (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="space-y-6 py-4">
        <ProgressBar
          value={expectativa}
          max={100}
          label=""
          showPercentage
          color="warning"
          size="lg"
        />
      </div>
    </div>
  );

  const renderErrorCard = (title: string) => (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle size={48} className="text-yellow-500 mb-4" />
        <p className="text-dark-muted text-sm">Houve um problema ao exibir esse gráfico.</p>
      </div>
    </div>
  );

  // Mostra skeleton enquanto carrega e não tem dados
  if (isLoading && !data.metas) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-dark-text">META SPA</h2>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with revalidating indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark-text">META SPA</h2>
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expectativa */}
        <div className="space-y-6">
          {renderMetaCard('Expectativa SPA - Meta I', metas.spa.meta1.expectativa, null, null)}
          {renderMetaCard('Expectativa SPA - Meta II', metas.spa.meta2.expectativa, null, null)}
          {renderMetaCard('Expectativa SPA - Meta III', metas.spa.meta3.expectativa, null, null)}
        </div>

        {/* Realidade */}
        <div className="space-y-6">
          {renderErrorCard('Realidade SPA - Meta I')}
          {renderErrorCard('Realidade SPA - Meta II')}
          {renderErrorCard('Realidade SPA - Meta III')}
        </div>

        {/* Diária */}
        <div className="space-y-6">
          {renderErrorCard('Diaria Atualizada')}
          {renderErrorCard('Diaria Atualizada')}
          {renderErrorCard('Diaria Atualizada')}
        </div>
      </div>

    </div>
  );
}
