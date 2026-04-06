import { useEffect, useState, useCallback } from 'react';
import {
  Plug, CheckCircle2, XCircle, Loader2, RefreshCw,
  MessageSquare, MessageCircle, Table, Database, Server,
  Eye, EyeOff, TestTube, X, Plus, ExternalLink, KeyRound,
} from 'lucide-react';
import HelpGuide from '../components/HelpGuide';

const CATEGORY_ICONS = {
  communication: MessageSquare,
  productivity: Table,
  database: Database,
  cloud: Server,
};

const CATEGORY_LABELS = {
  communication: 'Communication',
  productivity: 'Productivity',
  database: 'Database',
  cloud: 'Cloud Services',
};

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(null);
  const [showMcpAdd, setShowMcpAdd] = useState(false);
  const [tab, setTab] = useState('integrations');

  const refresh = async () => {
    try {
      const [intList, mcpList] = await Promise.all([
        window.dax.integrations.list(),
        window.dax.mcp.listServers(),
      ]);
      setIntegrations(intList || []);
      setMcpServers(mcpList || []);
    } catch (err) {
      console.error('[Integrations] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Group integrations by category
  const grouped = {};
  for (const int of integrations) {
    const cat = int.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(int);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-dax-text-dim" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dax-text-bright">Integrations</h1>
          <p className="text-sm text-dax-text-dim mt-1">
            Connect Dax to external services, MCP servers, and databases
          </p>
        </div>
        <div className="flex gap-2">
          <HelpGuide page="integrations" />
          <button onClick={refresh} className="btn-secondary btn-sm">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dax-sidebar rounded-lg p-1 w-fit">
        {['integrations', 'mcp'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-fast ${
              tab === t
                ? 'bg-dax-accent text-white'
                : 'text-dax-text-dim hover:text-dax-text'
            }`}
          >
            {t === 'integrations' ? 'Services' : 'MCP Servers'}
          </button>
        ))}
      </div>

      {tab === 'integrations' && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => {
            const CatIcon = CATEGORY_ICONS[cat] || Plug;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon size={14} className="text-dax-text-dim" />
                  <h2 className="text-sm font-medium text-dax-text-bright">
                    {CATEGORY_LABELS[cat] || cat}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((int) => (
                    <IntegrationCard
                      key={int.id}
                      integration={int}
                      onConfigure={() => setConfiguring(int)}
                      onRefresh={refresh}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mcp' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-dax-text-dim">
              Connect to MCP (Model Context Protocol) servers to extend agent capabilities
            </p>
            <button
              onClick={() => setShowMcpAdd(true)}
              className="btn-primary btn-sm"
            >
              <Plus size={12} />
              Add Server
            </button>
          </div>

          {mcpServers.length === 0 ? (
            <div className="agent-card p-8 text-center">
              <Server size={32} className="text-dax-text-dim mx-auto mb-2 opacity-30" />
              <p className="text-sm text-dax-text-dim">No MCP servers connected</p>
              <p className="text-xs text-dax-text-dim mt-1 opacity-60">
                Add an MCP server to give your agents access to external tools
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mcpServers.map((server) => (
                <McpServerCard key={server.id} server={server} onRefresh={refresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configure Modal */}
      {configuring && (
        <ConfigureModal
          integration={configuring}
          onClose={() => { setConfiguring(null); refresh(); }}
        />
      )}

      {/* Add MCP Server Modal */}
      {showMcpAdd && (
        <AddMcpModal
          onClose={() => { setShowMcpAdd(false); refresh(); }}
        />
      )}
    </div>
  );
}

function IntegrationCard({ integration, onConfigure, onRefresh }) {
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await window.dax.integrations.disconnect(integration.id);
      onRefresh();
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="agent-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgb(var(--dax-accent) / 0.1)' }}
          >
            <Plug size={16} className="text-dax-accent" />
          </div>
          <div>
            <div className="text-sm font-medium text-dax-text-bright">{integration.name}</div>
            <div className="text-[10px] text-dax-text-dim">{integration.description}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] ${
          integration.connected ? 'text-dax-success' : 'text-dax-text-dim'
        }`}>
          {integration.connected ? (
            <><CheckCircle2 size={10} /> Connected</>
          ) : (
            <><XCircle size={10} /> Not connected</>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onConfigure}
          className="btn-primary btn-sm"
        >
          {integration.connected ? 'Configure' : 'Connect'}
        </button>
        {integration.connected && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-secondary btn-sm"
          >
            {disconnecting ? <Loader2 size={10} className="animate-spin" /> : 'Disconnect'}
          </button>
        )}
      </div>

      {integration.connected && integration.actions?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dax-border">
          <div className="text-[10px] text-dax-text-dim">
            {integration.actions.length} actions available: {integration.actions.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

function McpServerCard({ server, onRefresh }) {
  const handleRemove = async () => {
    try {
      await window.dax.mcp.removeServer(server.id);
      onRefresh();
    } catch (err) {
      console.error('Remove MCP server failed:', err);
    }
  };

  return (
    <div className="agent-card p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Server size={16} className={server.connected ? 'text-dax-success' : 'text-dax-text-dim'} />
        <div>
          <div className="text-sm text-dax-text-bright">{server.name}</div>
          <div className="text-[10px] text-dax-text-dim">
            {server.tools?.length || 0} tools · {server.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>
      <button onClick={handleRemove} className="text-dax-text-dim hover:text-dax-error transition-fast p-1">
        <X size={14} />
      </button>
    </div>
  );
}

function ConfigureModal({ integration, onClose }) {
  const [creds, setCreds] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [oauthProvider, setOauthProvider] = useState(null);   // provider info if oauth supported
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthMode, setOauthMode] = useState(false);          // true = show oauth section
  const [oauthPending, setOauthPending] = useState(false);

  // Look up if this integration has an OAuth provider
  useEffect(() => {
    window.dax.oauth.providers().then((providers) => {
      const match = providers.find((p) => p.supportedIntegrations?.includes(integration.id));
      if (match) {
        setOauthProvider(match);
        // Default to OAuth mode if the integration has no API key fields
        const hasKeyFields = (integration.configFields || []).some((f) => f.type === 'password');
        setOauthMode(!hasKeyFields);
      }
    }).catch(() => {});
  }, [integration.id]);

  // Listen for OAuth success / error from main
  useEffect(() => {
    const offSuccess = window.dax.on.oauthSuccess((data) => {
      if (data.integrationId === integration.id) {
        setOauthPending(false);
        setTestResult({ success: true, message: `Connected via ${data.providerId} OAuth` });
        setTimeout(() => onClose(), 1200);
      }
    });
    const offError = window.dax.on.oauthError((data) => {
      setOauthPending(false);
      setTestResult({ success: false, message: data.error || 'OAuth failed' });
    });
    return () => { offSuccess(); offError(); };
  }, [integration.id, onClose]);

  const handleOAuthConnect = async () => {
    if (!oauthProvider) return;
    if (oauthProvider.requiresSecret && !oauthClientId) {
      setTestResult({ success: false, message: 'Client ID is required' });
      return;
    }
    setOauthPending(true);
    setTestResult(null);
    try {
      await window.dax.oauth.start({
        providerId: oauthProvider.id,
        integrationId: integration.id,
        clientId: oauthClientId || `dax_${oauthProvider.id}`,
        clientSecret: oauthClientSecret || null,
      });
      // Browser opened — user completes flow; result comes via oauth-success / oauth-error events
    } catch (err) {
      setOauthPending(false);
      setTestResult({ success: false, message: err.message });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.dax.integrations.test(integration.id, creds);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await window.dax.integrations.connect(integration.id, creds);
      onClose();
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const visibleFields = (integration.configFields || []).filter((f) => f.type !== 'hidden');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay">
      <div className="bg-dax-bg border border-dax-border rounded-xl w-[440px] shadow-2xl modal-panel">
        <div className="flex items-center justify-between p-4 border-b border-dax-border">
          <div>
            <h2 className="text-base font-semibold text-dax-text-bright">{integration.name}</h2>
            <p className="text-[11px] text-dax-text-dim">{integration.description}</p>
          </div>
          <button onClick={onClose} className="p-1 text-dax-text-dim hover:text-dax-text">
            <X size={16} />
          </button>
        </div>

        {/* Auth mode switcher */}
        {oauthProvider && visibleFields.length > 0 && (
          <div className="flex gap-1 mx-4 mt-4 bg-dax-sidebar rounded-lg p-1">
            <button
              onClick={() => setOauthMode(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-fast ${
                oauthMode ? 'bg-dax-accent text-white' : 'text-dax-text-dim hover:text-dax-text'
              }`}
            >
              <ExternalLink size={11} /> OAuth
            </button>
            <button
              onClick={() => setOauthMode(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-fast ${
                !oauthMode ? 'bg-dax-accent text-white' : 'text-dax-text-dim hover:text-dax-text'
              }`}
            >
              <KeyRound size={11} /> API Key
            </button>
          </div>
        )}

        <div className="p-4 space-y-3">

          {/* ── OAuth section ── */}
          {oauthProvider && oauthMode && (
            <div className="space-y-3">
              <p className="text-[11px] text-dax-text-dim leading-relaxed">
                Authorize Dax to access {oauthProvider.name} on your behalf. Your browser will open
                and redirect back automatically when done.
              </p>

              {oauthProvider.requiresSecret && (
                <>
                  <div>
                    <label className="block text-[11px] text-dax-text-dim mb-1">
                      {oauthProvider.name} Client ID <span className="text-dax-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      placeholder={`${oauthProvider.id}_client_id`}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-dax-text-dim mb-1">
                      Client Secret <span className="text-dax-text-dim opacity-60">(if required)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords['__oauth_secret'] ? 'text' : 'password'}
                        value={oauthClientSecret}
                        onChange={(e) => setOauthClientSecret(e.target.value)}
                        placeholder="optional"
                        className="input text-xs pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((s) => ({ ...s, __oauth_secret: !s.__oauth_secret }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-dax-text-dim"
                      >
                        {showPasswords['__oauth_secret'] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {testResult && (
                <div className={`p-2 rounded text-xs ${
                  testResult.success
                    ? 'bg-dax-success/10 text-dax-success border border-dax-success/20'
                    : 'bg-dax-error/10 text-dax-error border border-dax-error/20'
                }`}>
                  {testResult.message}
                </div>
              )}

              <button
                onClick={handleOAuthConnect}
                disabled={oauthPending}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2"
              >
                {oauthPending
                  ? <><Loader2 size={12} className="animate-spin" /> Waiting for browser…</>
                  : <><ExternalLink size={12} /> Connect with {oauthProvider.name}</>
                }
              </button>
            </div>
          )}

          {/* ── API Key section ── */}
          {(!oauthProvider || !oauthMode) && (
            <>
              {visibleFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] text-dax-text-dim mb-1">
                    {field.label} {field.required && <span className="text-dax-error">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={creds[field.key] || ''}
                      onChange={(e) => setCreds((c) => ({ ...c, [field.key]: e.target.value }))}
                      className="input text-xs"
                    >
                      <option value="">Select…</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                        value={creds[field.key] || ''}
                        onChange={(e) => setCreds((c) => ({ ...c, [field.key]: e.target.value }))}
                        placeholder={field.placeholder || ''}
                        className="input text-xs pr-8"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShowPasswords((s) => ({ ...s, [field.key]: !s[field.key] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-dax-text-dim"
                        >
                          {showPasswords[field.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {testResult && (
                <div className={`p-2 rounded text-xs ${
                  testResult.success
                    ? 'bg-dax-success/10 text-dax-success border border-dax-success/20'
                    : 'bg-dax-error/10 text-dax-error border border-dax-error/20'
                }`}>
                  {testResult.message}
                </div>
              )}
            </>
          )}
        </div>

        {(!oauthProvider || !oauthMode) && (
          <div className="flex items-center justify-between p-4 border-t border-dax-border">
            <button
              onClick={handleTest}
              disabled={testing}
              className="btn-secondary btn-sm"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
              Test Connection
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn-primary btn-sm"
              >
                {connecting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Connect
              </button>
            </div>
          </div>
        )}
        {oauthProvider && oauthMode && (
          <div className="flex justify-end p-4 border-t border-dax-border">
            <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddMcpModal({ onClose }) {
  const [name, setName] = useState('');
  const [transport, setTransport] = useState('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleAdd = async () => {
    setConnecting(true);
    setError(null);
    try {
      const config = {
        name: name || 'MCP Server',
        transport,
      };
      if (transport === 'stdio') {
        config.command = command;
        config.args = args.split(' ').filter(Boolean);
      } else {
        config.url = url;
      }
      await window.dax.mcp.addServer(config);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay">
      <div className="bg-dax-bg border border-dax-border rounded-xl w-[420px] shadow-2xl modal-panel">
        <div className="flex items-center justify-between p-4 border-b border-dax-border">
          <h2 className="text-base font-semibold text-dax-text-bright">Add MCP Server</h2>
          <button onClick={onClose} className="p-1 text-dax-text-dim hover:text-dax-text">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] text-dax-text-dim mb-1">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              className="input text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] text-dax-text-dim mb-1">Transport</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="input text-xs"
            >
              <option value="stdio">stdio (local process)</option>
              <option value="sse">SSE (HTTP endpoint)</option>
            </select>
          </div>

          {transport === 'stdio' ? (
            <>
              <div>
                <label className="block text-[11px] text-dax-text-dim mb-1">Command</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  className="input text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-dax-text-dim mb-1">Arguments (space-separated)</label>
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path/to/dir"
                  className="input text-xs"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[11px] text-dax-text-dim mb-1">Server URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000/mcp"
                className="input text-xs"
              />
            </div>
          )}

          {error && (
            <div className="p-2 rounded text-xs bg-dax-error/10 text-dax-error border border-dax-error/20">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-dax-border">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={connecting || (!command && transport === 'stdio') || (!url && transport === 'sse')}
            className="btn-primary btn-sm"
          >
            {connecting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
