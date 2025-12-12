import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, formatCompactNumber } from '../../utils/format';

interface DataPoint {
  name: string;
  [key: string]: number | string;
}

interface LineChartCardProps {
  title: string;
  data: DataPoint[];
  dataKeys: Array<{
    key: string;
    color: string;
    name: string;
    type?: 'monotone' | 'linear' | 'step';
  }>;
  xAxisKey?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  formatYAxis?: 'currency' | 'number' | 'compact';
}

export function LineChartCard({
  title,
  data,
  dataKeys,
  xAxisKey = 'name',
  showGrid = true,
  showLegend = true,
  height = 300,
  formatYAxis = 'compact',
}: LineChartCardProps) {
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
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
            }}
            formatter={(value: number) => [formatValue(value), '']}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {dataKeys.map((dk) => (
            <Line
              key={dk.key}
              type={dk.type || 'monotone'}
              dataKey={dk.key}
              name={dk.name}
              stroke={dk.color}
              strokeWidth={2}
              dot={{ fill: dk.color, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
