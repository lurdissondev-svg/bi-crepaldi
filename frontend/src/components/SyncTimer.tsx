import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../services/api';

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: 'success' | 'partial' | 'error' | null;
  intervalMinutes: number;
}

export function SyncTimer() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const status = await api.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  useEffect(() => {
    if (!syncStatus?.nextSyncAt) {
      setCountdown('--:--');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const next = new Date(syncStatus.nextSyncAt!);
      const diff = next.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Atualizando...');
        setTimeout(fetchSyncStatus, 5000);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [syncStatus?.nextSyncAt, fetchSyncStatus]);

  const getStatusIcon = () => {
    if (syncStatus?.isRunning) {
      return <RefreshCw size={14} className="animate-spin text-[var(--color-accent)]" />;
    }

    switch (syncStatus?.lastSyncStatus) {
      case 'success':
        return <CheckCircle size={14} className="text-emerald-500" />;
      case 'partial':
        return <AlertTriangle size={14} className="text-amber-500" />;
      case 'error':
        return <XCircle size={14} className="text-red-500" />;
      default:
        return <Clock size={14} className="text-[var(--color-text-muted)]" />;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
        title="Status da sincronizacao"
      >
        {getStatusIcon()}
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
            Prox. Atualizacao
          </span>
          <span className="text-sm font-mono text-[var(--color-text-primary)]">
            {syncStatus?.isRunning ? 'Sincronizando...' : countdown}
          </span>
        </div>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 p-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Sincronizacao</h4>
            <button
              onClick={(e) => { e.stopPropagation(); fetchSyncStatus(); }}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-muted)]">Status</span>
              <span className="text-xs text-[var(--color-text-primary)] flex items-center gap-1">
                {getStatusIcon()}
                {syncStatus?.isRunning ? 'Em andamento' :
                  syncStatus?.lastSyncStatus === 'success' ? 'Sucesso' :
                  syncStatus?.lastSyncStatus === 'partial' ? 'Parcial' :
                  syncStatus?.lastSyncStatus === 'error' ? 'Erro' : 'Aguardando'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-muted)]">Ultima Sync</span>
              <span className="text-xs text-[var(--color-text-primary)]">
                {formatDateTime(syncStatus?.lastSyncAt || null)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-muted)]">Proxima Sync</span>
              <span className="text-xs text-[var(--color-text-primary)]">
                {formatDateTime(syncStatus?.nextSyncAt || null)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-muted)]">Intervalo</span>
              <span className="text-xs text-[var(--color-text-primary)]">
                {syncStatus?.intervalMinutes || '--'} minutos
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Os dados sao atualizados automaticamente a cada {syncStatus?.intervalMinutes || 15} minutos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
