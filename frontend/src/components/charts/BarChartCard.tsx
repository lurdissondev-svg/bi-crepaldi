import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { formatCurrency, formatCompactNumber } from '../../utils/format';

interface DataPoint {
  name: string;
  value: number;
  [key: string]: number | string;
}

interface BarChartCardProps {
  title: string;
  data: DataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  colors?: string[];
  showGrid?: boolean;
  horizontal?: boolean;
  height?: number;
  formatYAxis?: 'currency' | 'number' | 'compact';
  showLabels?: boolean;
}

export function BarChartCard({
  title,
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  color = '#60a5fa',
  colors,
  showGrid = true,
  horizontal = false,
  height = 300,
  formatYAxis = 'compact',
  showLabels = true,
}: BarChartCardProps) {
  const formatValue = (value: number) => {
    switch (formatYAxis) {
      case 'currency':
        return formatCurrency(value);
      case 'compact':
        return formatCompactNumber(value);
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={!horizontal}
              horizontal={horizontal}
            />
          )}
          {horizontal ? (
            <>
              <XAxis
                type="number"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
              <YAxis
                type="category"
                dataKey={xAxisKey}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xAxisKey}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
            }}
            formatter={(value: number) => [formatValue(value), '']}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          >
            {colors && data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
            {showLabels && (
              <LabelList
                dataKey={dataKey}
                position={horizontal ? 'right' : 'top'}
                formatter={formatValue}
                fill="#94a3b8"
                fontSize={11}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
