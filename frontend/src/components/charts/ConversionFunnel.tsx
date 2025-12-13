interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  conversionFromPrevious?: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  title?: string;
  showLabels?: boolean;
  height?: number;
}

const STAGE_COLORS = {
  high: '#22c55e',    // Green - good conversion (>50%)
  medium: '#eab308',  // Yellow - moderate (20-50%)
  low: '#ef4444',     // Red - poor (<20%)
};

function getConversionColor(percentage: number): string {
  if (percentage >= 50) return STAGE_COLORS.high;
  if (percentage >= 20) return STAGE_COLORS.medium;
  return STAGE_COLORS.low;
}

export function ConversionFunnel({
  data,
  title = 'Funil de Conversão',
  showLabels = true,
  height = 400,
}: ConversionFunnelProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted mb-4" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M22 4L12 14.01l-3-3M2 12l5 5 5-5" />
          </svg>
          <p className="text-dark-muted text-sm">Nenhum dado para o funil de conversão</p>
          <p className="text-dark-muted text-xs mt-1">Ajuste os filtros de período</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="p-4" style={{ minHeight: height }}>
        <div className="flex flex-col space-y-3">
          {data.map((stage, index) => {
            const widthPercentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
            const conversionColor = stage.conversionFromPrevious !== undefined
              ? getConversionColor(stage.conversionFromPrevious)
              : '#60a5fa';

            return (
              <div key={stage.stage} className="relative">
                {/* Stage Label */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-dark-text">
                    {stage.stage}
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-dark-muted">
                      {stage.count.toLocaleString('pt-BR')}
                    </span>
                    {stage.conversionFromPrevious !== undefined && index > 0 && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${conversionColor}20`,
                          color: conversionColor,
                        }}
                      >
                        {stage.conversionFromPrevious.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="relative h-10 bg-dark-card rounded overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full rounded transition-all duration-500"
                    style={{
                      width: `${Math.max(widthPercentage, 2)}%`,
                      background: `linear-gradient(90deg, #60a5fa 0%, ${index === data.length - 1 ? '#22c55e' : '#3b82f6'} 100%)`,
                    }}
                  />
                  {showLabels && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-sm font-semibold text-white drop-shadow">
                        {stage.percentage.toFixed(1)}% do total
                      </span>
                    </div>
                  )}
                </div>

                {/* Connection Arrow */}
                {index < data.length - 1 && (
                  <div className="flex justify-center py-1">
                    <svg className="w-4 h-4 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-dark-border">
          <div className="flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: STAGE_COLORS.high }} />
              <span className="text-dark-muted">Conversão &gt; 50%</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: STAGE_COLORS.medium }} />
              <span className="text-dark-muted">20% - 50%</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: STAGE_COLORS.low }} />
              <span className="text-dark-muted">&lt; 20%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
