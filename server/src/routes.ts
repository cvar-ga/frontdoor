import { Router, Request, Response } from 'express';
import { scan, Severity } from './scanner';
import { callProvider, Provider, Message, MODEL_CATALOG, DEFAULT_MODEL } from './providers';

const router = Router();

// GET /api/config — surface which providers are configured and current settings
router.get('/config', (_req: Request, res: Response) => {
  const configured: Provider[] = [];
  if (process.env.OPENAI_API_KEY) configured.push('openai');
  if (process.env.GEMINI_API_KEY) configured.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) configured.push('anthropic');

  res.json({
    providers: configured,
    models: MODEL_CATALOG,
    defaultModels: DEFAULT_MODEL,
    sensitivity: (process.env.SENSITIVITY as Severity) || 'medium',
    forbiddenKeywords: (process.env.FORBIDDEN_KEYWORDS || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  });
});

interface ChatBody {
  provider: Provider;
  model?: string;
  messages: Message[];
  sensitivity?: Severity;
  forbiddenKeywords?: string[];
}

// POST /api/chat — scan then proxy to AI provider
router.post('/chat', async (req: Request, res: Response) => {
  const { provider, model, messages, sensitivity, forbiddenKeywords } = req.body as ChatBody;

  if (!provider || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'provider and messages are required' });
  }

  const effectiveSensitivity: Severity =
    sensitivity || (process.env.SENSITIVITY as Severity) || 'medium';
  const effectiveKeywords: string[] =
    forbiddenKeywords ||
    (process.env.FORBIDDEN_KEYWORDS || '').split(',').map((k) => k.trim()).filter(Boolean);

  // Only scan the latest user message
  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!latestUserMessage) {
    return res.status(400).json({ error: 'No user message found' });
  }

  const scanResult = scan(latestUserMessage.content, effectiveSensitivity, effectiveKeywords);

  if (!scanResult.clean) {
    return res.status(400).json({
      error: 'Request blocked: sensitive information detected',
      findings: scanResult.findings,
    });
  }

  const effectiveModel = model || DEFAULT_MODEL[provider];

  try {
    const response = await callProvider(provider, messages, effectiveModel, process.env);
    return res.json({ response, scanResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: `Provider error: ${message}` });
  }
});

// POST /api/scan — standalone scan endpoint (useful for testing)
router.post('/scan', (req: Request, res: Response) => {
  const { text, sensitivity, forbiddenKeywords } = req.body as {
    text: string;
    sensitivity?: Severity;
    forbiddenKeywords?: string[];
  };

  if (!text) return res.status(400).json({ error: 'text is required' });

  const effectiveSensitivity: Severity =
    sensitivity || (process.env.SENSITIVITY as Severity) || 'medium';
  const effectiveKeywords: string[] =
    forbiddenKeywords ||
    (process.env.FORBIDDEN_KEYWORDS || '').split(',').map((k) => k.trim()).filter(Boolean);

  const result = scan(text, effectiveSensitivity, effectiveKeywords);
  return res.json(result);
});

export default router;
