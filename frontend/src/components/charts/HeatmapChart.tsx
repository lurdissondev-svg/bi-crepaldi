interface HeatmapData {
  hour: number;
  dayOfWeek: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  height?: number;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityColor(value: number, maxValue: number): string {
  if (maxValue === 0 || value === 0) return '#1e293b';
  const intensity = value / maxValue;
  if (intensity < 0.25) return '#1e40af';
  if (intensity < 0.5) return '#3b82f6';
  if (intensity < 0.75) return '#60a5fa';
  return '#93c5fd';
}

export function HeatmapChart({
  data,
  title = 'Heatmap de Leads por Horário',
  height = 300,
}: HeatmapChartProps) {
  // Create matrix: 7 days x 24 hours
  const matrix: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

  data.forEach(item => {
    if (item.dayOfWeek >= 0 && item.dayOfWeek < 7 && item.hour >= 0 && item.hour < 24) {
      matrix[item.dayOfWeek][item.hour] = item.value;
    }
  });

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const totalLeads = data.reduce((sum, d) => sum + d.value, 0);

  // Find peak hour
  const peakHour = data.reduce((max, curr) => curr.value > max.value ? curr : max, { hour: 0, value: 0, dayOfWeek: 0 });

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted mb-4" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <p className="text-dark-muted text-sm">Nenhum dado para o heatmap</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>
      <div className="p-4" style={{ minHeight: height }}>
        {/* Stats Row */}
        <div className="flex justify-between mb-4 text-sm">
          <div>
            <span className="text-dark-muted">Total: </span>
            <span className="text-dark-text font-semibold">{totalLeads} leads</span>
          </div>
          <div>
            <span className="text-dark-muted">Pico: </span>
            <span className="text-primary-400 font-semibold">
              {DAYS_OF_WEEK[peakHour.dayOfWeek]} às {String(peakHour.hour).padStart(2, '0')}:00 ({peakHour.value} leads)
            </span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-12" /> {/* Spacer for day labels */}
              {HOURS.filter((_, i) => i % 2 === 0).map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-dark-muted" style={{ minWidth: '24px' }}>
                  {String(hour).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {DAYS_OF_WEEK.map((day, dayIndex) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 text-xs text-dark-muted pr-2 text-right">{day}</div>
                <div className="flex-1 flex gap-0.5">
                  {HOURS.map(hour => {
                    const value = matrix[dayIndex][hour];
                    return (
                      <div
                        key={hour}
                        className="flex-1 h-6 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary-400"
                        style={{
                          backgroundColor: getIntensityColor(value, maxValue),
                          minWidth: '12px',
                        }}
                        title={`${day} ${String(hour).padStart(2, '0')}:00 - ${value} leads`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-dark-muted">
          <span>Menos</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1e293b' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1e40af' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#60a5fa' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#93c5fd' }} />
          </div>
          <span>Mais</span>
        </div>
      </div>
    </div>
  );
}
