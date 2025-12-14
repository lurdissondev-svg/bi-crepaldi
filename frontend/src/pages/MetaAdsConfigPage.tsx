import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

type ConfigStatus = 'pending' | 'configured' | 'error';

interface FormData {
  appId: string;
  appSecret: string;
  accessToken: string;
  adAccountId: string;
  pixelId: string;
}

export function MetaAdsConfigPage() {
  const [formData, setFormData] = useState<FormData>({
    appId: '',
    appSecret: '',
    accessToken: '',
    adAccountId: '',
    pixelId: '',
  });

  const [status, setStatus] = useState<ConfigStatus>('pending');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    appSecret: false,
    accessToken: false,
  });

  // Load existing configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await api.getMetaAdsConfig();
      if (config) {
        setFormData({
          appId: config.appId || '',
          appSecret: config.appSecret || '',
          accessToken: config.accessToken || '',
          adAccountId: config.adAccountId || '',
          pixelId: config.pixelId || '',
        });
        setStatus(config.status);
        setLastSync(config.lastSync || null);
        setErrorMessage(config.errorMessage || null);
      }
    } catch (error) {
      // No config exists yet, that's fine
      console.log('No existing Meta Ads config found');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Reset status when user modifies config
    if (status === 'error') {
      setErrorMessage(null);
    }
  };

  const validateConfig = async () => {
    try {
      setValidating(true);
      setErrorMessage(null);

      const result = await api.validateMetaAdsConfig({
        appId: formData.appId,
        appSecret: formData.appSecret,
        accessToken: formData.accessToken,
        adAccountId: formData.adAccountId,
      });

      if (result.valid) {
        setAccountName(result.accountName || null);
        setPermissions(result.permissions || []);
        setStatus('configured');
        setErrorMessage(null);
      } else {
        setStatus('error');
        setErrorMessage(result.message);
      }

      return result.valid;
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao validar configuração');
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Validate first
      const isValid = await validateConfig();
      if (!isValid) {
        return;
      }

      // Save configuration
      await api.saveMetaAdsConfig({
        appId: formData.appId,
        appSecret: formData.appSecret,
        accessToken: formData.accessToken,
        adAccountId: formData.adAccountId,
        pixelId: formData.pixelId || undefined,
        status: 'configured',
      });

      setLastSync(new Date().toISOString());
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const toggleSecretVisibility = (field: 'appSecret' | 'accessToken') => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const formatAdAccountId = (value: string) => {
    // Remove 'act_' prefix if user accidentally includes it
    let formatted = value.replace(/^act_/, '');
    // Remove any non-numeric characters
    formatted = formatted.replace(/[^\d]/g, '');
    return formatted;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'configured':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle size={14} />
            Configurado
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <AlertCircle size={14} />
            Erro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            <AlertCircle size={14} />
            Pendente
          </span>
        );
    }
  };

  if (loading && !formData.appId) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Configuração Meta Ads</h1>
          <p className="text-sm text-dark-muted mt-1">
            Configure a integração com a API do Meta (Facebook/Instagram) Ads
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Info Card */}
      <div className="card bg-primary-600/10 border border-primary-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg">
            <ExternalLink size={20} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-dark-text">Como obter as credenciais</h3>
            <p className="text-xs text-dark-muted mt-1">
              Acesse o{' '}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                Meta for Developers
              </a>
              {' '}para criar um app e obter as credenciais necessárias.
            </p>
            <ul className="text-xs text-dark-muted mt-2 space-y-1 list-disc list-inside">
              <li>App ID e App Secret: Configurações do App</li>
              <li>Access Token: Ferramentas &gt; Graph API Explorer</li>
              <li>Ad Account ID: Seu ID de conta de anúncios (sem o prefixo "act_")</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="card bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-400">Erro de Configuração</h3>
              <p className="text-xs text-red-300 mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Info */}
      {status === 'configured' && accountName && (
        <div className="card bg-green-500/10 border border-green-500/20">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-400">Conta Conectada</h3>
              <p className="text-xs text-green-300 mt-1">
                Conta: <span className="font-medium">{accountName}</span>
              </p>
              {permissions.length > 0 && (
                <p className="text-xs text-green-300 mt-1">
                  Permissões: {permissions.join(', ')}
                </p>
              )}
              {lastSync && (
                <p className="text-xs text-dark-muted mt-1">
                  Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="card">
        <h2 className="text-lg font-semibold text-dark-text mb-4">Credenciais da API</h2>

        <div className="space-y-4">
          {/* App ID */}
          <div>
            <label htmlFor="appId" className="block text-sm font-medium text-dark-text mb-1.5">
              App ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="appId"
              value={formData.appId}
              onChange={(e) => handleInputChange('appId', e.target.value)}
              placeholder="Ex: 1234567890123456"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* App Secret */}
          <div>
            <label htmlFor="appSecret" className="block text-sm font-medium text-dark-text mb-1.5">
              App Secret <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecrets.appSecret ? 'text' : 'password'}
                id="appSecret"
                value={formData.appSecret}
                onChange={(e) => handleInputChange('appSecret', e.target.value)}
                placeholder="Ex: abc123def456..."
                className="w-full px-3 py-2 pr-10 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleSecretVisibility('appSecret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
              >
                {showSecrets.appSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Access Token */}
          <div>
            <label htmlFor="accessToken" className="block text-sm font-medium text-dark-text mb-1.5">
              Access Token <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecrets.accessToken ? 'text' : 'password'}
                id="accessToken"
                value={formData.accessToken}
                onChange={(e) => handleInputChange('accessToken', e.target.value)}
                placeholder="Token de acesso de longa duração"
                className="w-full px-3 py-2 pr-10 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleSecretVisibility('accessToken')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
              >
                {showSecrets.accessToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-dark-muted mt-1">
              Recomendamos usar um token de longa duração (60 dias)
            </p>
          </div>

          {/* Ad Account ID */}
          <div>
            <label htmlFor="adAccountId" className="block text-sm font-medium text-dark-text mb-1.5">
              Ad Account ID <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-dark-muted text-sm">act_</span>
              <input
                type="text"
                id="adAccountId"
                value={formData.adAccountId}
                onChange={(e) => handleInputChange('adAccountId', formatAdAccountId(e.target.value))}
                placeholder="1234567890123456"
                className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Pixel ID (Optional) */}
          <div>
            <label htmlFor="pixelId" className="block text-sm font-medium text-dark-text mb-1.5">
              Pixel ID <span className="text-dark-muted text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              id="pixelId"
              value={formData.pixelId}
              onChange={(e) => handleInputChange('pixelId', e.target.value)}
              placeholder="Ex: 1234567890123456"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-dark-muted mt-1">
              O Pixel ID é usado para rastrear conversões no site
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-dark-border">
          <button
            type="button"
            onClick={validateConfig}
            disabled={validating || !formData.appId || !formData.appSecret || !formData.accessToken || !formData.adAccountId}
            className="px-4 py-2 text-sm font-medium text-dark-text bg-dark-border rounded-lg hover:bg-dark-border/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validating ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Validando...
              </span>
            ) : (
              'Testar Conexão'
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !formData.appId || !formData.appSecret || !formData.accessToken || !formData.adAccountId}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Salvando...
              </span>
            ) : (
              'Salvar Configuração'
            )}
          </button>
        </div>
      </div>

      {/* Required Permissions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-dark-text mb-4">Permissões Necessárias</h2>
        <p className="text-sm text-dark-muted mb-3">
          O token de acesso deve ter as seguintes permissões para funcionar corretamente:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            'ads_read',
            'ads_management',
            'read_insights',
            'business_management',
          ].map((permission) => (
            <div
              key={permission}
              className="flex items-center gap-2 px-3 py-2 bg-dark-bg rounded-lg"
            >
              {permissions.includes(permission) ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-dark-muted" />
              )}
              <code className="text-xs text-dark-text">{permission}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
