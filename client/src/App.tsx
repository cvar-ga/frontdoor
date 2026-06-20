import { useState, useEffect, useRef, useCallback } from 'react';
import type { Provider, Message, Config, SensitivityLevel } from './types';
import { fetchConfig, sendChat } from './api';

const PROVIDER: Provider = 'gemini';
const GEMINI_COLOR = '#4285f4';
const MODEL_LABEL = 'Gemini 2.5 Flash';

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('medium');
  const [keywords, setKeywords] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSensitivity(cfg.sensitivity);
        setKeywords(cfg.forbiddenKeywords.join(', '));
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

  const model = config?.defaultModels[PROVIDER] ?? 'gemini-2.5-flash';
  const serverKeyConfigured = (config?.providers ?? []).includes(PROVIDER);
  const hasPastedKey = apiKey.trim().length > 0;
  const canSend = !!config && (serverKeyConfigured || hasPastedKey);

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
    const result = await sendChat(
      PROVIDER,
      model,
      history,
      sensitivity,
      forbiddenKeywordList,
      apiKey.trim() || undefined,
    );
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
  }, [input, loading, messages, model, sensitivity, forbiddenKeywordList, apiKey]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🚪</span>
          <span className="logo-text">Front Door</span>
        </div>

        {/* ── Active model (Gemini only) ── */}
        <div className="sidebar-section">
          <label className="section-label">AI Model</label>
          {configError ? (
            <div className="error-badge">{configError}</div>
          ) : !config ? (
            <div className="loading-text">Loading…</div>
          ) : (
            <div className="active-model" style={{ borderColor: GEMINI_COLOR }}>
              <span className="active-model-dot" style={{ background: GEMINI_COLOR }} />
              <span className="active-model-name">{MODEL_LABEL}</span>
            </div>
          )}
          <p className="hint">Front Door is configured to use Google Gemini.</p>
        </div>

        {/* ── API key ── */}
        <div className="sidebar-section">
          <label className="section-label">API Key</label>
          <div className="key-input-wrap">
            <input
              type={showApiKey ? 'text' : 'password'}
              className="key-input"
              placeholder="Paste your Gemini API key…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="key-toggle"
              onClick={() => setShowApiKey((s) => !s)}
              title={showApiKey ? 'Hide key' : 'Show key'}
            >
              {showApiKey ? '🙈' : '👁'}
            </button>
          </div>
          {serverKeyConfigured ? (
            <p className="key-detected">Server key configured ✓ (paste one to override)</p>
          ) : hasPastedKey ? (
            <p className="key-detected">Key ready ✓</p>
          ) : null}
          <p className="hint">Paste your Google Gemini API key. Any key format is accepted.</p>
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
        <header className="topbar" style={{ borderBottomColor: GEMINI_COLOR }}>
          <div className="topbar-title">
            Secure AI Gateway
            {config && (
              <span className="topbar-provider" style={{ color: GEMINI_COLOR }}>
                → {MODEL_LABEL}
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
                Your prompts are scanned for sensitive data before reaching Gemini.
                {config && !canSend && (
                  <span className="setup-note"><br />Paste your Gemini API key in the sidebar to begin.</span>
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
                    <div className="bubble-meta">via {msg.model}</div>
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
              !canSend
                ? 'Paste your Gemini API key in the sidebar to start chatting…'
                : `Message ${MODEL_LABEL} (Shift+Enter for new line)`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={loading || !canSend}
          />
          <button
            className="send-btn"
            onClick={submit}
            disabled={loading || !input.trim() || !canSend}
            style={{ backgroundColor: GEMINI_COLOR }}
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
      </main>
    </div>
  );
}
