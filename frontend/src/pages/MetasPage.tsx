import { useEffect, useState } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { ProgressBar } from '../components/dashboard/ProgressBar';
import { useDashboard } from '../hooks/useDashboard';
import { AlertTriangle } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';

export function MetasPage() {
  const { data, loading, filters, setFilters, filterOptions, fetchMetas } = useDashboard();

  const [metas, setMetas] = useState({
    spa: {
      meta1: { expectativa: 43.48, realidade: null, diaria: null },
      meta2: { expectativa: 43.48, realidade: null, diaria: null },
      meta3: { expectativa: 43.48, realidade: null, diaria: null },
    },
  });

  useEffect(() => {
    fetchMetas();
  }, [fetchMetas]);

  useEffect(() => {
    if (data.metas) {
      setMetas(data.metas.metaSpa);
    }
  }, [data.metas]);

  const renderMetaCard = (
    title: string,
    expectativa: number,
    realidade: number | null,
    diaria: number | null
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
  if (loading && !data.metas) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-dark-text">META SPA</h2>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-dark-text">META SPA</h2>

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
