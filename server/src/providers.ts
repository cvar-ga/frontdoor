export type Provider = 'openai' | 'gemini' | 'anthropic';

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

async function callOpenAI(messages: Message[], apiKey: string): Promise<ProviderResponse> {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model: 'gpt-4o-mini',
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

async function callGemini(messages: Message[], apiKey: string): Promise<ProviderResponse> {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {},
    { contents },
  ) as { candidates: { content: { parts: { text: string }[] } }[] };

  return {
    content: data.candidates[0].content.parts[0].text,
    model: 'gemini-1.5-flash',
    provider: 'gemini',
  };
}

async function callAnthropic(messages: Message[], apiKey: string): Promise<ProviderResponse> {
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    {
      model: 'claude-haiku-4-5-20251001',
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
  env: NodeJS.ProcessEnv,
): Promise<ProviderResponse> {
  switch (provider) {
    case 'openai': {
      const key = env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is not configured');
      return callOpenAI(messages, key);
    }
    case 'gemini': {
      const key = env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY is not configured');
      return callGemini(messages, key);
    }
    case 'anthropic': {
      const key = env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured');
      return callAnthropic(messages, key);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
