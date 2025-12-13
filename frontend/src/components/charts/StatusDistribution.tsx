import { useMemo } from 'react';

interface StatusData {
  id: string;
  name: string;
  count: number;
  semantic: string;
  avgDaysInStatus: number;
}

interface StatusDistributionProps {
  data: StatusData[];
  title?: string;
  showDaysInStatus?: boolean;
}

const SEMANTIC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  P: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Em Processo' },
  S: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Sucesso' },
  F: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Falha' },
};

function getSemanticStyle(semantic: string) {
  return SEMANTIC_COLORS[semantic] || SEMANTIC_COLORS.P;
}

export function StatusDistribution({
  data,
  title = 'Distribuição de Status',
  showDaysInStatus = true,
}: StatusDistributionProps) {
  const totalLeads = useMemo(() =>
    data.reduce((sum, status) => sum + status.count, 0),
    [data]
  );

  const maxCount = useMemo(() =>
    Math.max(...data.map(s => s.count), 1),
    [data]
  );

  const semanticSummary = useMemo(() => {
    const summary = {
      P: { count: 0, label: 'Em Processo' },
      S: { count: 0, label: 'Sucesso' },
      F: { count: 0, label: 'Falha' },
    };

    data.forEach(status => {
      const semantic = status.semantic || 'P';
      if (summary[semantic as keyof typeof summary]) {
        summary[semantic as keyof typeof summary].count += status.count;
      }
    });

    return summary;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center h-64">
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted mb-4" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-dark-muted text-sm">Nenhum dado de status disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(semanticSummary).map(([key, value]) => {
          const style = getSemanticStyle(key);
          const percentage = totalLeads > 0 ? ((value.count / totalLeads) * 100).toFixed(1) : '0';
          return (
            <div key={key} className={`rounded-lg p-3 ${style.bg}`}>
              <p className={`text-2xl font-bold ${style.text}`}>{value.count}</p>
              <p className="text-xs text-dark-muted">{value.label}</p>
              <p className={`text-xs ${style.text}`}>{percentage}%</p>
            </div>
          );
        })}
      </div>

      {/* Status List */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {data.map(status => {
          const style = getSemanticStyle(status.semantic);
          const percentage = totalLeads > 0 ? ((status.count / totalLeads) * 100).toFixed(1) : '0';
          const widthPercentage = (status.count / maxCount) * 100;

          return (
            <div key={status.id} className="bg-dark-card rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${style.bg.replace('/20', '')}`} />
                  <span className="text-sm font-medium text-dark-text">{status.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-dark-muted">{status.count} leads</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.bg.replace('/20', '')}`}
                  style={{ width: `${widthPercentage}%` }}
                />
              </div>

              {/* Days in status */}
              {showDaysInStatus && status.avgDaysInStatus > 0 && (
                <div className="flex items-center justify-end mt-2">
                  <span className="text-xs text-dark-muted">
                    Média de {status.avgDaysInStatus} dias neste status
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-dark-border">
        <div className="flex items-center justify-center space-x-6 text-xs">
          {Object.entries(SEMANTIC_COLORS).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-1">
              <div className={`w-3 h-3 rounded ${value.bg.replace('/20', '')}`} />
              <span className="text-dark-muted">{value.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
