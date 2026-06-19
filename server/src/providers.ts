export type Provider = 'openai' | 'gemini' | 'anthropic';

export interface ModelInfo {
  id: string;
  label: string;
}

// Only models available on each provider's free API tier.
// OpenAI: no free tier — gpt-4o-mini and gpt-3.5-turbo are the lowest-cost paid options.
// Gemini: free tier available for all listed models (rate-limited).
// Anthropic: no free tier — Haiku 4.5 is the lowest-cost paid option.
export const MODEL_CATALOG: Record<Provider, ModelInfo[]> = {
  openai: [
    { id: 'gpt-4o-mini',   label: 'GPT-4o Mini'   },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash',               label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-flash',               label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro',                 label: 'Gemini 1.5 Pro'   },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  openai:    'gpt-4o-mini',
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5-20251001',
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

async function callOpenAI(messages: Message[], apiKey: string, model: string): Promise<ProviderResponse> {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 2048,
    },
  ) as { choices: { message: { content: string } }[]; model: string };

  return {
    content: data.choices[0].message.content,
    model: data.model,
    provider: 'openai',
  };
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

async function callAnthropic(messages: Message[], apiKey: string, model: string): Promise<ProviderResponse> {
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    {
      model,
      max_tokens: 2048,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
  ) as { content: { text: string }[]; model: string };

  return {
    content: data.content[0].text,
    model: data.model,
    provider: 'anthropic',
  };
}

export async function callProvider(
  provider: Provider,
  messages: Message[],
  model: string,
  env: NodeJS.ProcessEnv,
  apiKey?: string,
): Promise<ProviderResponse> {
  switch (provider) {
    case 'openai': {
      const key = apiKey || env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is not configured');
      return callOpenAI(messages, key, model);
    }
    case 'gemini': {
      const key = apiKey || env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY is not configured');
      return callGemini(messages, key, model);
    }
    case 'anthropic': {
      const key = apiKey || env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');
      return callAnthropic(messages, key, model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
