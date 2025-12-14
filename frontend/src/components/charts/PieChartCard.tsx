import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface DataPoint {
  name: string;
  value: number;
}

interface PieChartCardProps {
  title: string;
  data: DataPoint[];
  colors?: string[];
  showLegend?: boolean;
  showTotal?: boolean;
  totalLabel?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#a78bfa', '#fb7185', '#22d3ee', '#a3e635',
  '#e879f9', '#f97316',
];

export function PieChartCard({
  title,
  data,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTotal = true,
  totalLabel = 'TOTAL',
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
}: PieChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={500}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              formatter={(value: number) => [
                formatCurrency(value),
                '',
              ]}
            />
            {showLegend && (
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  paddingLeft: '20px',
                  fontSize: '12px',
                }}
                formatter={(value: string) => {
                  const item = data.find(d => d.name === value);
                  if (!item) return value;
                  const percent = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <span className="text-dark-muted">
                      {value} <span className="text-dark-text">{formatPercentage(percent)}</span>
                    </span>
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total - positioned relative to pie chart center */}
        {showTotal && innerRadius > 0 && (
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{
              top: '50%',
              left: showLegend ? '28%' : '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <p className="text-xl font-bold text-dark-text">
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-dark-muted">{totalLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}
