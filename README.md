# Kizuna AI — Your Cultural Compass

A cross-cultural communication tool powered by AI that decodes hidden meanings in high-context interactions, specializing in Japanese business culture.

**Live Demo:** [https://kizuna-ai-app.onrender.com](https://kizuna-ai-app.onrender.com)

## What It Does

Paste a phrase or describe an interaction from a high-context culture (Japan, Korea, China, etc.), and Kizuna AI will:

- **Translate** the literal and hidden meaning
- **Analyze** the cultural nuance and social hierarchy at play
- **Rate confidence** with a transparent reasoning path (XAI)
- **Suggest** two strategic responses — one to push forward, one to accept gracefully

## Tech Stack

- **Frontend:** React + Tailwind CSS
- **LLM:** GPT-5.4-mini via OpenAI-compatible API
- **Server:** Express.js (API proxy keeps keys server-side)
- **Prompt Design:** Chain-of-Thought with structured JSON output
- **Deployment:** Render (Web Service)

## Architecture

```
Browser  →  /api/chat/completions  →  Express Server (Render)
                                          ├── Injects API key
                                          ├── Proxies to LLM API
                                          └── Serves static React build
```

## Local Development

```bash
# Install dependencies
npm install

# Create your environment file
cp .env.example .env.local
# Edit .env.local and add your API key

# Start dev server
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_KIZUNA_API_KEY` | API key for local development (used by Vite proxy) |
| `KIZUNA_API_KEY` | API key for production (used by Express server on Render) |

## Deployment

Deployed on [Render](https://render.com) as a Web Service.

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment variable:** Set `KIZUNA_API_KEY` in Render dashboard

## License

April Ma All Rights Reserved
