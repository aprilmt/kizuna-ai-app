import express from 'express';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '';
const AUTH_COOKIE = 'kizuna_demo_auth';
const AUTH_SECRET = process.env.DEMO_AUTH_SECRET || DEMO_PASSWORD || 'kizuna-demo-dev';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

function signToken(nonce) {
  return createHmac('sha256', AUTH_SECRET).update(`kizuna:${nonce}`).digest('hex');
}

function createAuthCookieValue() {
  const nonce = randomBytes(16).toString('hex');
  return `${nonce}.${signToken(nonce)}`;
}

function isValidAuthCookie(value) {
  if (!value || !value.includes('.')) return false;
  const [nonce, signature] = value.split('.');
  if (!nonce || !signature) return false;
  const expected = signToken(nonce);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  if (!DEMO_PASSWORD) return true;
  const cookies = parseCookies(req.headers.cookie);
  return isValidAuthCookie(cookies[AUTH_COOKIE]);
}

function setAuthCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(createAuthCookieValue())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(COOKIE_MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function loginPageHtml({ error = false } = {}) {
  const errorBlock = error
    ? `<p class="error">Incorrect password. Please try again.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kizuna AI — Demo Access</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&family=Rubik:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #293E53;
      --ink-deep: #1e2f40;
      --muted: #64748b;
      --line: #e2e8f0;
      --bg: #F8FAFC;
      --card: #ffffff;
      --danger: #dc2626;
      --danger-bg: #fef2f2;
      --danger-border: #fecaca;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Rubik", "Noto Sans JP", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(41, 62, 83, 0.08), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(41, 62, 83, 0.06), transparent 50%),
        var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      width: 100%;
      max-width: 26rem;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 2.5rem;
      box-shadow: 0 18px 50px rgba(41, 62, 83, 0.08);
      padding: 2.5rem 2rem;
      text-align: center;
      animation: enter 700ms ease-out both;
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(1.5rem); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo {
      width: 5.5rem;
      height: 5.5rem;
      object-fit: contain;
      margin: 0 auto 1rem;
      display: block;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #020617;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 0.5rem 0 0;
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .jp {
      margin: 0.25rem 0 0;
      color: #94a3b8;
      font-size: 0.8rem;
    }
    form {
      margin-top: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      text-align: left;
    }
    label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink);
    }
    input[type="password"] {
      width: 100%;
      border: 1px solid var(--line);
      background: #f8fafc;
      border-radius: 1.25rem;
      padding: 0.95rem 1.1rem;
      font: inherit;
      font-size: 1rem;
      color: #1e293b;
      outline: none;
      transition: box-shadow 160ms ease, border-color 160ms ease;
    }
    input[type="password"]:focus {
      border-color: transparent;
      box-shadow: 0 0 0 2px var(--ink);
    }
    button {
      margin-top: 0.35rem;
      width: 100%;
      border: 0;
      border-radius: 1.25rem;
      padding: 1rem 1.25rem;
      background: var(--ink);
      color: white;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 28px rgba(41, 62, 83, 0.2);
      transition: background 160ms ease, transform 120ms ease;
    }
    button:hover { background: var(--ink-deep); }
    button:active { transform: scale(0.98); }
    .error {
      margin: 1rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger);
      font-size: 0.875rem;
      text-align: left;
    }
    .hint {
      margin: 1.25rem 0 0;
      font-size: 0.75rem;
      color: #94a3b8;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/logo.png" alt="Kizuna AI" />
    <h1>Kizuna AI</h1>
    <p class="sub">Private demo access</p>
    <p class="jp">デモアクセス</p>
    <form method="POST" action="/api/auth/login">
      <label for="password">Demo password</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password"
        placeholder="Enter password"
        required
        autofocus
      />
      <button type="submit">Enter demo</button>
    </form>
    ${errorBlock}
    <p class="hint">This live demo is password-protected. Contact the owner if you need access.</p>
  </main>
</body>
</html>`;
}

// Health check bypasses auth (configure Render health check path to /health)
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  if (!DEMO_PASSWORD) {
    return res.redirect('/');
  }

  const password = req.body?.password ?? '';
  const wantsJson = (req.headers.accept || '').includes('application/json')
    || req.headers['content-type']?.includes('application/json');

  if (!safeEqual(password, DEMO_PASSWORD)) {
    if (wantsJson) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.status(401).type('html').send(loginPageHtml({ error: true }));
    return;
  }

  setAuthCookie(res);

  if (wantsJson) {
    return res.json({ ok: true });
  }
  return res.redirect('/');
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (!DEMO_PASSWORD || isAuthenticated(req)) {
    return res.redirect('/');
  }
  res.type('html').send(loginPageHtml());
});

app.use((req, res, next) => {
  if (!DEMO_PASSWORD || isAuthenticated(req)) return next();

  // Allow logo/favicon so the login page can brand itself
  if (req.path === '/logo.png' || req.path === '/favicon.svg' || req.path === '/favicon.ico') {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(401).type('html').send(loginPageHtml());
  }

  return res.status(401).json({ error: 'Authentication required.' });
});

app.use(express.static(join(__dirname, 'dist')));

app.post('/api/chat/completions', async (req, res) => {
  const apiKey = process.env.KIZUNA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured.' });
  }

  try {
    const upstream = await fetch('https://api.zhizengzeng.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach upstream API.' });
  }
});

app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kizuna AI server running on port ${PORT}`);
  if (DEMO_PASSWORD) {
    console.log('Demo password protection: enabled');
  } else {
    console.log('Demo password protection: disabled (set DEMO_PASSWORD to enable)');
  }
});
