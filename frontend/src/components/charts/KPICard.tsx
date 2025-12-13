import { formatCurrency } from '../../utils/format';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage' | 'days';
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function formatKPIValue(value: number, format: string = 'number'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${value.toFixed(0)} dias`;
    default:
      return value.toLocaleString('pt-BR');
  }
}

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  purple: 'bg-purple-500/20 text-purple-400',
};

const iconColors = {
  blue: '#60a5fa',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a855f7',
};

export function KPICard({
  title,
  value,
  previousValue,
  format = 'number',
  icon,
  color = 'blue',
  subtitle,
  trend,
}: KPICardProps) {
  const variation = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : null;

  const isPositive = variation !== null ? variation >= 0 : trend === 'up';
  const showVariation = variation !== null || trend;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-dark-muted mb-1">{title}</p>
          <p className="text-2xl font-bold text-dark-text">
            {formatKPIValue(value, format)}
          </p>
          {subtitle && (
            <p className="text-xs text-dark-muted mt-1">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>

      {showVariation && (
        <div className="mt-3 pt-3 border-t border-dark-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-muted">
              {previousValue !== undefined ? 'vs período anterior' : 'tendência'}
            </span>
            <span
              className={`flex items-center text-sm font-medium ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {isPositive ? (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {variation !== null ? `${Math.abs(variation).toFixed(1)}%` : (isPositive ? 'Alta' : 'Baixa')}
            </span>
          </div>
          {previousValue !== undefined && (
            <p className="text-xs text-dark-muted mt-1">
              Anterior: {formatKPIValue(previousValue, format)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Quick metrics grid component
interface QuickMetricsProps {
  metrics: Array<{
    title: string;
    value: number;
    previousValue?: number;
    format?: 'number' | 'currency' | 'percentage' | 'days';
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  }>;
}

export function QuickMetrics({ metrics }: QuickMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <KPICard key={index} {...metric} />
      ))}
    </div>
  );
}
