# Front Door

A secure gateway for internal users accessing public AI providers. Every prompt is scanned for sensitive data before it leaves your network. Requests containing PII, credentials, or other configured sensitive content are blocked and never forwarded.

## Supported AI providers and models

Users choose a provider and model from the sidebar. All listed models are the lowest-cost or free-tier options available from each provider.

### OpenAI (ChatGPT)
| Model ID | Label |
|---|---|
| `gpt-4o-mini` | GPT-4o Mini *(default)* |
| `gpt-3.5-turbo` | GPT-3.5 Turbo |

> OpenAI has no free API tier. Both models require a paid account.

### Google Gemini
| Model ID | Label |
|---|---|
| `gemini-2.5-flash-preview-05-20` | Gemini 2.5 Flash *(default)* |
| `gemini-2.0-flash` | Gemini 2.0 Flash |
| `gemini-1.5-flash` | Gemini 1.5 Flash |
| `gemini-1.5-pro` | Gemini 1.5 Pro |

> Gemini offers a free API tier (rate-limited) for all listed models.

### Anthropic (Claude)
| Model ID | Label |
|---|---|
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 *(default)* |

> Anthropic has no free API tier. Haiku 4.5 is the lowest-cost paid option.

## What the scanner detects

| Severity | Types |
|---|---|
| **HIGH** | PEM private keys, Social Security Numbers, credit/debit card numbers (Luhn-validated), custom forbidden keywords |
| **MEDIUM** | AWS credentials, OpenAI/Anthropic/Google API keys, JWT tokens, inline password assignments, internal RFC-1918 IP addresses |
| **LOW** | US phone numbers, email addresses |

The **sensitivity** setting controls the minimum severity level that triggers a block. It can be set server-wide via `.env` or overridden per session in the UI sidebar.

## Quick start (Windows)

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- API key(s) for at least one AI provider

### 1. Install dependencies

```powershell
npm run install:all
```

### 2. Configure API keys

**Option A — paste a key directly in the UI (easiest)**

Start the server first (step 3), then paste any API key into the **API Key** field in the sidebar. The provider is detected automatically from the key prefix and the corresponding provider button unlocks immediately. No server restart needed.

| Key prefix | Provider |
|---|---|
| `sk-ant-…` | Anthropic (Claude) |
| `AIza…` | Google Gemini |
| `sk-…` / `sk-proj-…` | OpenAI (ChatGPT) |

Keys entered this way are held in browser memory for the session only and sent securely with each request.

**Option B — configure server-side keys in `.env`**

Use the included PowerShell setup script:

```powershell
.\scripts\Set-FrontDoorKeys.ps1
```

The script will prompt you for each provider's API key and write them to `.env`. Press Enter to skip any provider you don't want to configure. You only need at least one key to use the app.

**Optional — persist keys as Windows environment variables** (requires running as Administrator):

```powershell
.\scripts\Set-FrontDoorKeys.ps1 -Persist
```

This writes the keys to both `.env` and to the Windows machine environment so they survive reboots and are available to all users on the workstation.

**Manual alternative** — copy the example file and edit it yourself:

```powershell
copy .env.example .env
```

Then open `.env` in any text editor and fill in the key(s) you want.

### 3. Start the development servers

```powershell
npm run dev
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:3001

Both servers start together and hot-reload on file changes.

## Configuration

All server-side configuration lives in `.env`:

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key (can also be supplied per-session via the UI) |
| `GEMINI_API_KEY` | — | Google Gemini API key (can also be supplied per-session via the UI) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (can also be supplied per-session via the UI) |
| `PORT` | `3001` | Backend server port |
| `SENSITIVITY` | `medium` | `high` / `medium` / `low` — minimum severity to block |
| `FORBIDDEN_KEYWORDS` | — | Comma-separated list of always-blocked terms |

Per-session overrides for sensitivity, forbidden keywords, and API keys are available directly in the UI sidebar. A key pasted in the UI takes precedence over the corresponding `.env` key for that session.

## Project structure

```
frontdoor/
├── package.json               # Root — starts both servers together with `npm run dev`
├── .env.example               # Template — copy to .env and fill in API keys
├── scripts/
│   └── Set-FrontDoorKeys.ps1  # PowerShell script for sysadmins to configure API keys
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Express app entry point
│       ├── routes.ts          # /api/chat  /api/scan  /api/config
│       ├── scanner.ts         # Sensitive data detection engine
│       └── providers.ts       # Model catalog + OpenAI / Gemini / Anthropic proxies
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx           # React entry point
        ├── App.tsx            # Main UI — sidebar, chat, model selector
        ├── api.ts             # Fetch helpers for the backend API
        ├── types.ts           # Shared TypeScript types
        └── styles.css
```

## API reference

### `POST /api/chat`
Scans the latest user message, then forwards the conversation to the selected provider and model.

```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "sensitivity": "medium",
  "forbiddenKeywords": ["confidential"],
  "apiKey": "AIza..."
}
```

- `model` is optional — omitting it uses the provider's default model.
- `apiKey` is optional — if provided, it overrides the server-side `.env` key for this request. The UI uses this field when a key is pasted into the sidebar.
- Returns `400` with a `findings[]` array if sensitive data is detected.
- Returns `200` with the provider response if the prompt is clean.

### `POST /api/scan`
Standalone scan endpoint — useful for testing detection patterns without sending anything to an AI provider.

```json
{ "text": "My SSN is 123-45-6789", "sensitivity": "medium" }
```

### `GET /api/config`
Returns the list of configured providers, the full model catalog, default models, and server-side sensitivity settings.
