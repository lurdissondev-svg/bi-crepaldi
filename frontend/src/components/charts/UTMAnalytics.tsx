import { useState, useMemo } from 'react';

interface UTMSourceData {
  source: string;
  total: number;
  converted: number;
  disqualified: number;
  inProgress: number;
  campaigns: Record<string, { total: number; converted: number; disqualified: number }>;
}

interface UTMMediumData {
  medium: string;
  total: number;
  converted: number;
  disqualified: number;
  inProgress: number;
}

interface UTMCampaignData {
  campaign: string;
  total: number;
  converted: number;
  disqualified: number;
  inProgress: number;
  sources: Record<string, { total: number; converted: number }>;
}

interface UTMAnalyticsProps {
  bySource: UTMSourceData[];
  byMedium: UTMMediumData[];
  byCampaign: UTMCampaignData[];
  title?: string;
}

type TabType = 'source' | 'medium' | 'campaign';

function getConversionColor(rate: number): string {
  if (rate >= 30) return 'text-green-400';
  if (rate >= 15) return 'text-yellow-400';
  return 'text-red-400';
}

function ConversionBadge({ converted, total }: { converted: number; total: number }) {
  const rate = total > 0 ? (converted / total) * 100 : 0;
  return (
    <span className={`text-xs font-semibold ${getConversionColor(rate)}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 bg-dark-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function UTMAnalytics({
  bySource,
  byMedium,
  byCampaign,
  title = 'Análise de UTM',
}: UTMAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('source');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const maxTotal = useMemo(() => {
    switch (activeTab) {
      case 'source':
        return Math.max(...bySource.map(s => s.total), 1);
      case 'medium':
        return Math.max(...byMedium.map(m => m.total), 1);
      case 'campaign':
        return Math.max(...byCampaign.map(c => c.total), 1);
    }
  }, [activeTab, bySource, byMedium, byCampaign]);

  const hasData = bySource.length > 0 || byMedium.length > 0 || byCampaign.length > 0;

  if (!hasData) {
    return (
      <div className="card">
        <h3 className="card-header">{title}</h3>
        <div className="flex flex-col items-center justify-center h-64">
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted mb-4" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <p className="text-dark-muted text-sm">Nenhum dado de UTM disponível</p>
          <p className="text-dark-muted text-xs mt-1">Verifique se os leads possuem parâmetros UTM</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'source', label: 'Por Fonte', count: bySource.length },
    { id: 'medium', label: 'Por Medium', count: byMedium.length },
    { id: 'campaign', label: 'Por Campanha', count: byCampaign.length },
  ];

  return (
    <div className="card">
      <h3 className="card-header">{title}</h3>

      {/* Tabs */}
      <div className="flex border-b border-dark-border mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-dark-muted">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {activeTab === 'source' && bySource.map(source => (
          <div key={source.source} className="bg-dark-card rounded-lg p-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedSource(expandedSource === source.source ? null : source.source)}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-dark-text">
                      {source.source}
                    </span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-dark-muted">{source.total} leads</span>
                      <ConversionBadge converted={source.converted} total={source.total} />
                    </div>
                  </div>
                  <ProgressBar value={source.total} max={maxTotal} color="#60a5fa" />
                </div>
                <svg
                  className={`w-4 h-4 text-dark-muted transition-transform ${expandedSource === source.source ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Campaigns breakdown */}
            {expandedSource === source.source && Object.keys(source.campaigns).length > 0 && (
              <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
                <p className="text-xs text-dark-muted mb-2">Campanhas:</p>
                {Object.entries(source.campaigns)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([campaign, data]) => (
                    <div key={campaign} className="flex items-center justify-between text-xs">
                      <span className="text-dark-text truncate max-w-[200px]">{campaign}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-dark-muted">{data.total}</span>
                        <ConversionBadge converted={data.converted} total={data.total} />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border text-xs">
              <span className="text-green-400">
                <span className="text-dark-muted">Convertidos:</span> {source.converted}
              </span>
              <span className="text-yellow-400">
                <span className="text-dark-muted">Em progresso:</span> {source.inProgress}
              </span>
              <span className="text-red-400">
                <span className="text-dark-muted">Desqualificados:</span> {source.disqualified}
              </span>
            </div>
          </div>
        ))}

        {activeTab === 'medium' && byMedium.map(medium => (
          <div key={medium.medium} className="bg-dark-card rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-dark-text">
                {medium.medium}
              </span>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-dark-muted">{medium.total} leads</span>
                <ConversionBadge converted={medium.converted} total={medium.total} />
              </div>
            </div>
            <ProgressBar value={medium.total} max={maxTotal} color="#a78bfa" />

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border text-xs">
              <span className="text-green-400">
                <span className="text-dark-muted">Convertidos:</span> {medium.converted}
              </span>
              <span className="text-yellow-400">
                <span className="text-dark-muted">Em progresso:</span> {medium.inProgress}
              </span>
              <span className="text-red-400">
                <span className="text-dark-muted">Desqualificados:</span> {medium.disqualified}
              </span>
            </div>
          </div>
        ))}

        {activeTab === 'campaign' && byCampaign.map(campaign => (
          <div key={campaign.campaign} className="bg-dark-card rounded-lg p-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedCampaign(expandedCampaign === campaign.campaign ? null : campaign.campaign)}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-dark-text truncate max-w-[300px]">
                      {campaign.campaign}
                    </span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-dark-muted">{campaign.total} leads</span>
                      <ConversionBadge converted={campaign.converted} total={campaign.total} />
                    </div>
                  </div>
                  <ProgressBar value={campaign.total} max={maxTotal} color="#34d399" />
                </div>
                <svg
                  className={`w-4 h-4 text-dark-muted transition-transform ${expandedCampaign === campaign.campaign ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Sources breakdown */}
            {expandedCampaign === campaign.campaign && Object.keys(campaign.sources).length > 0 && (
              <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
                <p className="text-xs text-dark-muted mb-2">Fontes:</p>
                {Object.entries(campaign.sources)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([source, data]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-dark-text">{source}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-dark-muted">{data.total}</span>
                        <ConversionBadge converted={data.converted} total={data.total} />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border text-xs">
              <span className="text-green-400">
                <span className="text-dark-muted">Convertidos:</span> {campaign.converted}
              </span>
              <span className="text-yellow-400">
                <span className="text-dark-muted">Em progresso:</span> {campaign.inProgress}
              </span>
              <span className="text-red-400">
                <span className="text-dark-muted">Desqualificados:</span> {campaign.disqualified}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-4 border-t border-dark-border">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-400">
              {bySource.reduce((acc, s) => acc + s.total, 0)}
            </p>
            <p className="text-xs text-dark-muted">Total de Leads</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">
              {bySource.reduce((acc, s) => acc + s.converted, 0)}
            </p>
            <p className="text-xs text-dark-muted">Convertidos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              {(() => {
                const total = bySource.reduce((acc, s) => acc + s.total, 0);
                const converted = bySource.reduce((acc, s) => acc + s.converted, 0);
                return total > 0 ? ((converted / total) * 100).toFixed(1) : '0';
              })()}%
            </p>
            <p className="text-xs text-dark-muted">Taxa Conversão</p>
          </div>
        </div>
      </div>
    </div>
  );
}
