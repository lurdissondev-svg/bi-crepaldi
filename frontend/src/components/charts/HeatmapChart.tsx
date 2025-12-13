interface HeatmapData {
  hour: number;
  day?: number;
  dayOfWeek?: number;
  count?: number;
  value?: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  height?: number;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityColor(value: number, maxValue: number, isDark: boolean): string {
  if (maxValue === 0 || value === 0) {
    return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  }
  const intensity = value / maxValue;

  // Indigo color scale
  if (intensity < 0.25) return isDark ? '#312e81' : '#e0e7ff';
  if (intensity < 0.5) return isDark ? '#4338ca' : '#c7d2fe';
  if (intensity < 0.75) return isDark ? '#6366f1' : '#a5b4fc';
  return isDark ? '#818cf8' : '#6366f1';
}

export function HeatmapChart({
  data,
  title = 'Heatmap de Leads por Horario',
  height = 300,
}: HeatmapChartProps) {
  // Detect dark mode
  const isDark = document.documentElement.classList.contains('dark');

  // Normalize data - accept both API format (day, count) and component format (dayOfWeek, value)
  const normalizedData = data.map(item => ({
    dayOfWeek: item.dayOfWeek ?? item.day ?? 0,
    hour: item.hour,
    value: item.value ?? item.count ?? 0,
  }));

  // Create matrix: 7 days x 24 hours
  const matrix: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

  normalizedData.forEach(item => {
    if (item.dayOfWeek >= 0 && item.dayOfWeek < 7 && item.hour >= 0 && item.hour < 24) {
      matrix[item.dayOfWeek][item.hour] = item.value;
    }
  });

  const maxValue = Math.max(...normalizedData.map(d => d.value), 1);
  const totalLeads = normalizedData.reduce((sum, d) => sum + d.value, 0);

  // Find peak hour
  const peakHour = normalizedData.reduce((max, curr) => curr.value > max.value ? curr : max, { hour: 0, value: 0, dayOfWeek: 0 });

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-[var(--color-text-muted)] mb-4" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <p className="text-[var(--color-text-muted)] text-sm">Nenhum dado para o heatmap</p>
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
            <span className="text-[var(--color-text-muted)]">Total: </span>
            <span className="text-[var(--color-text-primary)] font-semibold">{totalLeads} leads</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Pico: </span>
            <span className="text-[var(--color-accent)] font-semibold">
              {DAYS_OF_WEEK[peakHour.dayOfWeek]} as {String(peakHour.hour).padStart(2, '0')}:00 ({peakHour.value} leads)
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
                <div key={hour} className="flex-1 text-center text-xs text-[var(--color-text-muted)]" style={{ minWidth: '24px' }}>
                  {String(hour).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {DAYS_OF_WEEK.map((day, dayIndex) => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 text-xs text-[var(--color-text-muted)] pr-2 text-right font-medium">{day}</div>
                <div className="flex-1 flex gap-0.5">
                  {HOURS.map(hour => {
                    const value = matrix[dayIndex][hour];
                    return (
                      <div
                        key={hour}
                        className="flex-1 h-6 rounded-sm transition-all duration-200 cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)] hover:ring-offset-1"
                        style={{
                          backgroundColor: getIntensityColor(value, maxValue, isDark),
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
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Menos</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: isDark ? '#312e81' : '#e0e7ff' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: isDark ? '#4338ca' : '#c7d2fe' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: isDark ? '#6366f1' : '#a5b4fc' }} />
            <div className="w-4 h-4 rounded" style={{ backgroundColor: isDark ? '#818cf8' : '#6366f1' }} />
          </div>
          <span>Mais</span>
        </div>
      </div>
    </div>
  );
}
