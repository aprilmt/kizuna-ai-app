# Kizuna AI — Your Cultural Compass

**Live Demo:** [https://kizuna-ai-app.onrender.com](https://kizuna-ai-app.onrender.com)

## About

Kizuna AI is an AI-powered cultural intelligence tool designed for international professionals navigating high-context societies — particularly Japan, Korea, and China.

In these cultures, what people say often differs from what they mean. A polite "I'll consider it" from a Japanese manager may actually be a soft refusal. A Chinese colleague's "It's not convenient" might be a firm no wrapped in courtesy. These unspoken rules — shaped by social hierarchy, face-saving, and indirect communication — are invisible to outsiders and rarely taught in textbooks.

Kizuna bridges this gap. It acts as a real-time cultural interpreter that goes beyond literal translation to reveal the hidden intent, social dynamics, and emotional subtext behind everyday business interactions.

<img width="613" height="765" alt="kizuna-ui" src="https://github.com/user-attachments/assets/ab102a33-5fac-463f-9396-3ed93d52d069" />

## The Problem It Solves

International professionals often misread high-context communication, leading to:

- Missed signals in negotiations (e.g., interpreting a polite decline as genuine interest)
- Damaged relationships from culturally inappropriate follow-ups
- Lost deals and opportunities due to misaligned expectations

Traditional translation tools handle words, not meaning. Kizuna handles both.

## What It Does

Paste a phrase or describe an interaction, and Kizuna AI will:

- **Translate** both the literal words and the hidden cultural meaning
- **Analyze** the social hierarchy, power dynamics, and unspoken intent at play
- **Rate confidence** with a transparent reasoning path — making the AI's logic visible (Explainable AI)
- **Suggest** two strategic responses — one to push forward, one to accept gracefully

## Who It's For

- Expats and international managers working in Japan, Korea, or China
- Global business teams navigating cross-cultural negotiations
- UX/AI researchers studying trust in human-AI interaction
- Anyone who has ever wondered "what did they *really* mean?"

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
