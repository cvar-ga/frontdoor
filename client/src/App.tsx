import { useState, useEffect, useRef, useCallback } from 'react';
import type { Provider, Message, Config, SensitivityLevel } from './types';
import { fetchConfig, sendChat } from './api';

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'ChatGPT',
  gemini: 'Gemini',
  anthropic: 'Claude',
};

const PROVIDER_COLORS: Record<Provider, string> = {
  openai: '#10a37f',
  gemini: '#4285f4',
  anthropic: '#d97706',
};

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('openai');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('medium');
  const [keywords, setKeywords] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSensitivity(cfg.sensitivity);
        setKeywords(cfg.forbiddenKeywords.join(', '));
        if (cfg.providers.length > 0) setProvider(cfg.providers[0]);
      })
      .catch(() => setConfigError('Cannot reach the Front Door server. Is it running?'));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const forbiddenKeywordList = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = [...messages, userMsg];
    const result = await sendChat(provider, history, sensitivity, forbiddenKeywordList);
    setLoading(false);

    if (result.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: result.content,
          provider: result.provider,
          model: result.model,
          timestamp: Date.now(),
        },
      ]);
    } else if (result.blocked) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: '',
          blocked: true,
          findings: result.findings,
          timestamp: Date.now(),
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: `Error: ${result.error}`,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [input, loading, messages, provider, sensitivity, forbiddenKeywordList]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const activeColor = config ? PROVIDER_COLORS[provider] : '#6b7280';

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🚪</span>
          <span className="logo-text">Front Door</span>
        </div>

        <div className="sidebar-section">
          <label className="section-label">AI Provider</label>
          {configError ? (
            <div className="error-badge">{configError}</div>
          ) : !config ? (
            <div className="loading-text">Loading…</div>
          ) : config.providers.length === 0 ? (
            <div className="error-badge">No providers configured. Add API keys to .env</div>
          ) : (
            <div className="provider-list">
              {(['openai', 'gemini', 'anthropic'] as Provider[]).map((p) => {
                const available = config.providers.includes(p);
                return (
                  <button
                    key={p}
                    className={`provider-btn ${provider === p ? 'active' : ''} ${!available ? 'disabled' : ''}`}
                    style={provider === p ? { borderColor: PROVIDER_COLORS[p], color: PROVIDER_COLORS[p] } : {}}
                    onClick={() => available && setProvider(p)}
                    title={available ? '' : 'API key not configured'}
                  >
                    {PROVIDER_LABELS[p]}
                    {!available && <span className="lock">🔒</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <label className="section-label">Sensitivity</label>
          <div className="sensitivity-group">
            {(['low', 'medium', 'high'] as SensitivityLevel[]).map((s) => (
              <button
                key={s}
                className={`sens-btn ${sensitivity === s ? 'active' : ''}`}
                onClick={() => setSensitivity(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <p className="hint">
            {sensitivity === 'high'
              ? 'Blocks HIGH + MEDIUM + LOW findings'
              : sensitivity === 'medium'
              ? 'Blocks HIGH + MEDIUM findings'
              : 'Blocks HIGH findings only'}
          </p>
        </div>

        <div className="sidebar-section">
          <label className="section-label">Forbidden Keywords</label>
          <textarea
            className="kw-input"
            placeholder="e.g. confidential, project-x"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
          />
          <p className="hint">Comma-separated. Always blocked regardless of sensitivity.</p>
        </div>

        <button className="clear-btn" onClick={() => setMessages([])}>
          Clear conversation
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <header className="topbar" style={{ borderBottomColor: activeColor }}>
          <div className="topbar-title">
            Secure AI Gateway
            {config && config.providers.includes(provider) && (
              <span className="topbar-provider" style={{ color: activeColor }}>
                → {PROVIDER_LABELS[provider]}
              </span>
            )}
          </div>
          <div className="shield">🛡️ Scanning enabled</div>
        </header>

        <div className="message-list">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🚪</div>
              <div className="empty-title">Front Door</div>
              <div className="empty-sub">
                Your prompts are scanned for sensitive data before reaching any AI provider.
                {config && config.providers.length === 0 && (
                  <span className="setup-note"><br />Add your API keys to <code>.env</code> and restart the server.</span>
                )}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="bubble user-bubble">{msg.content}</div>
              ) : msg.blocked ? (
                <div className="blocked-bubble">
                  <div className="blocked-header">🚫 Request blocked</div>
                  <div className="blocked-sub">Sensitive information detected in your prompt:</div>
                  <ul className="findings-list">
                    {msg.findings?.map((f, i) => (
                      <li key={i} className={`finding finding-${f.severity.toLowerCase()}`}>
                        <span className="finding-type">{f.type}</span>
                        <span className="finding-desc">{f.description}</span>
                        <span className="finding-sev">{f.severity}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="blocked-note">Remove the flagged content and try again.</div>
                </div>
              ) : (
                <div className="bubble assistant-bubble">
                  <div className="bubble-content">{msg.content}</div>
                  {msg.model && (
                    <div className="bubble-meta">
                      via {msg.model}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="bubble assistant-bubble loading-bubble">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="input-bar">
          <textarea
            className="input-box"
            placeholder={
              config && config.providers.length === 0
                ? 'Configure at least one provider in .env to start chatting…'
                : `Message ${config ? PROVIDER_LABELS[provider] : '…'} (Shift+Enter for new line)`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={loading || !config || config.providers.length === 0}
          />
          <button
            className="send-btn"
            onClick={submit}
            disabled={loading || !input.trim() || !config || config.providers.length === 0}
            style={{ backgroundColor: activeColor }}
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
      </main>
    </div>
  );
}
