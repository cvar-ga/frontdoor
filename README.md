# Front Door

A secure gateway for internal users accessing public AI providers. Every prompt is scanned for sensitive data before it leaves your network. Requests containing PII, credentials, or other configured sensitive content are blocked and never forwarded.

## Supported AI Providers

| Provider | Model used |
|---|---|
| OpenAI (ChatGPT) | gpt-4o-mini |
| Google Gemini | gemini-1.5-flash |
| Anthropic (Claude) | claude-haiku-4-5 |

## What the scanner detects

| Severity | Types |
|---|---|
| **HIGH** | PEM private keys, Social Security Numbers, credit/debit card numbers (Luhn-validated), custom forbidden keywords |
| **MEDIUM** | AWS credentials, OpenAI/Anthropic/Google API keys, JWT tokens, inline password assignments, internal RFC-1918 IP addresses |
| **LOW** | US phone numbers, email addresses |

The **sensitivity** setting controls the minimum severity level that triggers a block.

## Quick start (Windows)

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- API key(s) for at least one AI provider

### 1. Install dependencies

```
npm run install:all
```

### 2. Configure environment

```
copy .env.example .env
```

Open `.env` and add your API key(s). You only need one provider to get started.

### 3. Start development servers

```
npm run dev
```

- Frontend → http://localhost:5173  
- Backend API → http://localhost:3001

Both servers start together and hot-reload on file changes.

## Configuration

All configuration lives in `.env`:

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `PORT` | `3001` | Backend server port |
| `SENSITIVITY` | `medium` | `high` / `medium` / `low` — minimum severity to block |
| `FORBIDDEN_KEYWORDS` | — | Comma-separated list of always-blocked terms |

Per-session overrides for sensitivity and forbidden keywords are also available directly in the UI sidebar.

## Project structure

```
frontdoor/
├── package.json          # Root: runs both servers together
├── .env.example
├── server/
│   └── src/
│       ├── index.ts      # Express app entry
│       ├── routes.ts     # /api/chat  /api/scan  /api/config
│       ├── scanner.ts    # Sensitive data detection engine
│       └── providers.ts  # OpenAI / Gemini / Anthropic proxies
└── client/
    └── src/
        ├── App.tsx       # Main UI
        ├── api.ts        # Fetch helpers
        ├── types.ts
        └── styles.css
```

## API

### `POST /api/chat`
Forward a conversation to the selected provider (after scanning).

```json
{
  "provider": "openai",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "sensitivity": "medium",
  "forbiddenKeywords": ["confidential"]
}
```

Returns `400` with `findings[]` if sensitive data is detected. Returns `200` with the provider response if clean.

### `POST /api/scan`
Standalone scan endpoint — useful for testing your patterns.

```json
{ "text": "My SSN is 123-45-6789", "sensitivity": "medium" }
```

### `GET /api/config`
Returns configured providers and server-side defaults.
