import type { Provider, Message, Finding, Config, SensitivityLevel } from './types';

const BASE = '/api';

export async function fetchConfig(): Promise<Config> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Failed to load config');
  return res.json();
}

export interface ChatSuccess {
  ok: true;
  content: string;
  model: string;
  provider: Provider;
}

export interface ChatBlocked {
  ok: false;
  blocked: true;
  findings: Finding[];
}

export interface ChatError {
  ok: false;
  blocked: false;
  error: string;
}

export type ChatResult = ChatSuccess | ChatBlocked | ChatError;

export async function sendChat(
  provider: Provider,
  messages: Pick<Message, 'role' | 'content'>[],
  sensitivity: SensitivityLevel,
  forbiddenKeywords: string[],
): Promise<ChatResult> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      messages: messages.map(({ role, content }) => ({ role, content })),
      sensitivity,
      forbiddenKeywords,
    }),
  });

  const data = await res.json();

  if (res.status === 400 && data.findings) {
    return { ok: false, blocked: true, findings: data.findings };
  }
  if (!res.ok) {
    return { ok: false, blocked: false, error: data.error || 'Unknown error' };
  }
  return {
    ok: true,
    content: data.response.content,
    model: data.response.model,
    provider: data.response.provider,
  };
}
