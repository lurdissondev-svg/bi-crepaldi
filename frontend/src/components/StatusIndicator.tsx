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
  connected: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500' },
  warning: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500' },
  not_configured: { icon: Settings, color: 'text-gray-400', bg: 'bg-gray-500' },
  pending: { icon: Settings, color: 'text-yellow-400', bg: 'bg-yellow-500' },
  unknown: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-500' },
};

export function StatusIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchHealth();
    // Refresh health status every 5 minutes
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
    if (!health) return 'bg-gray-500';
    if (health.status === 'healthy') return 'bg-green-500';
    if (health.status === 'degraded') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <RefreshCw size={14} className="animate-spin text-dark-muted" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-dark-border transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${getOverallStatusColor()}`} />
        <span className="text-xs text-dark-muted">
          {health?.status === 'healthy' ? 'Sistema OK' :
           health?.status === 'degraded' ? 'Parcial' : 'Problema'}
        </span>
      </button>

      {showDetails && health && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-dark-card border border-dark-border rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-dark-text">Status das Integrações</h4>
            <button
              onClick={(e) => { e.stopPropagation(); fetchHealth(); }}
              className="p-1 rounded hover:bg-dark-border"
            >
              <RefreshCw size={14} className={`text-dark-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2">
            {Object.entries(health.integrations).map(([key, value]) => {
              const config = getStatusIndicator(value.status);
              const Icon = config.icon;
              const labels: Record<string, string> = {
                bitrix24: 'Bitrix24 CRM',
                belle: 'Belle Software',
                metaAds: 'Meta Ads',
              };

              return (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-dark-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={config.color} />
                    <span className="text-sm text-dark-text">{labels[key]}</span>
                  </div>
                  <span className="text-xs text-dark-muted">{value.message}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-dark-border text-xs text-dark-muted">
            <p>Uptime: {Math.floor(health.uptime / 60)} min</p>
            <p>Atualizado: {new Date(health.timestamp).toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
