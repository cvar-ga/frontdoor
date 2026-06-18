import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
    message: { error: 'Too many requests — please slow down.' },
  }),
);

app.use('/api', routes);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Front Door server running on http://localhost:${PORT}`);
  const providers = [];
  if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
  if (process.env.GEMINI_API_KEY) providers.push('Gemini');
  if (process.env.ANTHROPIC_API_KEY) providers.push('Anthropic');
  console.log(`Configured providers: ${providers.length ? providers.join(', ') : 'none (add keys to .env)'}`);
  console.log(`Sensitivity level: ${process.env.SENSITIVITY || 'medium'}`);
});
