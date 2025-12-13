import { formatCurrency } from '../../utils/format';

interface ComparisonMetric {
  label: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency' | 'percentage';
}

interface PeriodComparisonProps {
  title?: string;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  metrics: ComparisonMetric[];
}

function formatValue(value: number, format: string = 'number'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString('pt-BR');
  }
}

function getVariation(current: number, previous: number): { value: number; isPositive: boolean } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current > 0 };
  const variation = ((current - previous) / previous) * 100;
  return { value: Math.abs(variation), isPositive: variation >= 0 };
}

export function PeriodComparison({
  title = 'Comparativo de Períodos',
  currentPeriodLabel = 'Este mês',
  previousPeriodLabel = 'Mês anterior',
  metrics,
}: PeriodComparisonProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center h-48">
          <p className="text-dark-muted text-sm">Nenhum dado para comparar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="p-4">
        {/* Header */}
        <div className="grid grid-cols-4 gap-4 mb-4 pb-2 border-b border-dark-border">
          <div className="text-sm font-medium text-dark-muted">Métrica</div>
          <div className="text-sm font-medium text-dark-muted text-right">{previousPeriodLabel}</div>
          <div className="text-sm font-medium text-dark-muted text-right">{currentPeriodLabel}</div>
          <div className="text-sm font-medium text-dark-muted text-right">Variação</div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          {metrics.map((metric, index) => {
            const variation = getVariation(metric.current, metric.previous);

            return (
              <div key={index} className="grid grid-cols-4 gap-4 items-center py-2">
                <div className="text-sm text-dark-text">{metric.label}</div>
                <div className="text-sm text-dark-muted text-right">
                  {formatValue(metric.previous, metric.format)}
                </div>
                <div className="text-sm text-dark-text font-semibold text-right">
                  {formatValue(metric.current, metric.format)}
                </div>
                <div className="flex items-center justify-end">
                  <span
                    className={`flex items-center text-sm font-medium ${
                      variation.isPositive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {variation.isPositive ? (
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {variation.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual comparison bars */}
        <div className="mt-6 pt-4 border-t border-dark-border">
          <p className="text-xs text-dark-muted mb-3">Visualização comparativa</p>
          {metrics.slice(0, 4).map((metric, index) => {
            const maxVal = Math.max(metric.current, metric.previous, 1);
            const currentWidth = (metric.current / maxVal) * 100;
            const previousWidth = (metric.previous / maxVal) * 100;

            return (
              <div key={index} className="mb-3">
                <p className="text-xs text-dark-muted mb-1">{metric.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-muted w-20">{previousPeriodLabel}</span>
                    <div className="flex-1 h-4 bg-dark-card rounded overflow-hidden">
                      <div
                        className="h-full bg-dark-muted rounded transition-all duration-500"
                        style={{ width: `${previousWidth}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-muted w-20">{currentPeriodLabel}</span>
                    <div className="flex-1 h-4 bg-dark-card rounded overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded transition-all duration-500"
                        style={{ width: `${currentWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
