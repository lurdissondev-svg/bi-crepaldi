import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface NPSGaugeProps {
  value: number; // -100 to 100 for NPS
  title?: string;
  detratores?: number;
  passivos?: number;
  promotores?: number;
}

export function NPSGauge({
  value,
  title = 'NPS',
  detratores = 0,
  passivos = 0,
  promotores = 0,
}: NPSGaugeProps) {
  // Normalize value from -100..100 to 0..100 for display
  const normalizedValue = ((value + 100) / 200) * 100;

  // Create data for the gauge background
  const gaugeData = [
    { value: 33.33, color: '#ef4444' }, // Detratores (vermelho)
    { value: 33.33, color: '#f59e0b' }, // Passivos (amarelo)
    { value: 33.34, color: '#22c55e' }, // Promotores (verde)
  ];

  // Determine color based on NPS value
  const getValueColor = () => {
    if (value < 0) return '#ef4444';
    if (value < 50) return '#f59e0b';
    return '#22c55e';
  };

  const getZoneLabel = () => {
    if (value < 0) return 'Zona Critica';
    if (value < 50) return 'Zona de Aperfeicoamento';
    if (value < 75) return 'Zona de Qualidade';
    return 'Zona de Excelencia';
  };

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="flex flex-col items-center">
        <div className="relative w-full" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Background gauge */}
              <Pie
                data={gaugeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {gaugeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={0.3} />
                ))}
              </Pie>
              {/* Value indicator */}
              <Pie
                data={[{ value: normalizedValue }, { value: 100 - normalizedValue }]}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={getValueColor()} />
                <Cell fill="transparent" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
            <span
              className="text-4xl font-bold"
              style={{ color: getValueColor() }}
            >
              {value.toFixed(1)}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] mt-1">
              {getZoneLabel()}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between w-full px-4 mt-2 text-xs">
          <span className="text-[#ef4444]">-100</span>
          <span className="text-[#f59e0b]">0</span>
          <span className="text-[#22c55e]">100</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 w-full mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">{detratores}</span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] uppercase">Detratores</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">{passivos}</span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] uppercase">Passivos</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">{promotores}</span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] uppercase">Promotores</span>
          </div>
        </div>
      </div>
    </div>
  );
}
