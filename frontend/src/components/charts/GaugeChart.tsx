import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/format';

interface GaugeChartProps {
  title: string;
  value: number;
  maxValue: number;
  color?: string;
  showValue?: boolean;
  height?: number;
}

export function GaugeChart({
  title,
  value,
  maxValue,
  color = '#60a5fa',
  showValue = true,
  height = 200,
}: GaugeChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const remaining = 100 - percentage;

  // Determine color based on percentage
  const getColor = () => {
    if (percentage >= 80) return '#22c55e'; // Green
    if (percentage >= 50) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const data = [
    { name: 'completed', value: percentage },
    { name: 'remaining', value: remaining },
  ];

  const gaugeColor = color === '#60a5fa' ? getColor() : color;

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="70%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={gaugeColor} />
              <Cell fill="#334155" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Value */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '20%' }}>
            <p className="text-2xl font-bold text-dark-text">
              {formatCurrency(value)}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-dark-muted">
              <span>R$0,00</span>
              <span>{formatCurrency(maxValue)}</span>
            </div>
          </div>
        )}

        {/* Scale markers */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-between px-8 text-xs text-dark-muted">
          <span>R$0,00</span>
          <span>{formatCurrency(maxValue / 2)}</span>
          <span>{formatCurrency(maxValue)}</span>
        </div>
      </div>
    </div>
  );
}
