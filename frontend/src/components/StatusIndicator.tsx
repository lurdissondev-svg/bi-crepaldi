import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Settings, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface IntegrationStatus {
  status: string;
  message: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  integrations: {
    bitrix24: IntegrationStatus;
    belle: IntegrationStatus;
    metaAds: IntegrationStatus;
  };
}

const STATUS_CONFIG = {
  connected: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
  not_configured: { icon: Settings, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]' },
  pending: { icon: Settings, color: 'text-amber-500', bg: 'bg-amber-500' },
  unknown: { icon: AlertCircle, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]' },
};

export function StatusIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await api.getDetailedHealth();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndicator = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown;
  };

  const getOverallStatusColor = () => {
    if (!health) return 'bg-[var(--color-text-muted)]';
    if (health.status === 'healthy') return 'bg-emerald-500';
    if (health.status === 'degraded') return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <RefreshCw size={14} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${getOverallStatusColor()} shadow-sm`} />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {health?.status === 'healthy' ? 'Sistema OK' :
           health?.status === 'degraded' ? 'Parcial' : 'Problema'}
        </span>
      </button>

      {showDetails && health && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 p-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Status das Integracoes</h4>
            <button
              onClick={(e) => { e.stopPropagation(); fetchHealth(); }}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <RefreshCw size={14} className={`text-[var(--color-text-muted)] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-1">
            {Object.entries(health.integrations).map(([key, value]) => {
              const config = getStatusIndicator(value.status);
              const Icon = config.icon;
              const labels: Record<string, string> = {
                bitrix24: 'Bitrix24 CRM',
                belle: 'Belle Software',
                metaAds: 'Meta Ads',
              };

              return (
                <div key={key} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={config.color} />
                    <span className="text-sm text-[var(--color-text-primary)]">{labels[key]}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{value.message}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)]">
            <p>Uptime: {Math.floor(health.uptime / 60)} min</p>
            <p>Atualizado: {new Date(health.timestamp).toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
