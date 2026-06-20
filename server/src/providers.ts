export type Provider = 'gemini';

export interface ModelInfo {
  id: string;
  label: string;
}

// Front Door is configured to use Google Gemini exclusively.
export const MODEL_CATALOG: Record<Provider, ModelInfo[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
};

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderResponse {
  content: string;
  model: string;
  provider: Provider;
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function callGemini(messages: Message[], apiKey: string, model: string): Promise<ProviderResponse> {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {},
    { contents },
  ) as { candidates: { content: { parts: { text: string }[] } }[] };

  return {
    content: data.candidates[0].content.parts[0].text,
    model,
    provider: 'gemini',
  };
}

export async function callProvider(
  provider: Provider,
  messages: Message[],
  model: string,
  env: NodeJS.ProcessEnv,
  apiKey?: string,
): Promise<ProviderResponse> {
  if (provider !== 'gemini') {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const key = apiKey?.trim() || env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  return callGemini(messages, key, model);
}
