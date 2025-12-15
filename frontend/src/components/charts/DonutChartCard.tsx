import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartCardProps {
  title: string;
  data: DonutDataItem[];
  showTotal?: boolean;
  totalLabel?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

const COLORS = [
  'var(--color-accent)',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

export function DonutChartCard({
  title,
  data,
  showTotal = true,
  totalLabel = 'TOTAL',
  height = 300,
  formatValue = (v) => v.toLocaleString('pt-BR'),
}: DonutChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg px-3 py-2 shadow-lg">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.name}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {formatValue(item.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="flex flex-col gap-2 mt-4">
      {data.map((item, index) => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        return (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
              />
              <span className="text-[var(--color-text-secondary)] truncate max-w-[150px]">
                {item.name}
              </span>
            </div>
            <span className="text-[var(--color-text-primary)] font-medium">{percentage}%</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0" style={{ width: height - 50, height: height - 50 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {showTotal && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatValue(total)}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {totalLabel}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">{renderLegend()}</div>
      </div>
    </div>
  );
}
