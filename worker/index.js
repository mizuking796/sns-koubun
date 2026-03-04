// SNS構文ミュージアム API Worker
// Gemini API中継 + レート制限 + キーローテーション

const API_KEYS = [
  'AIzaSyCFXwb7gybuMpStBFQFwcYYilR03aOKWhw',
  'AIzaSyAtbEjgQrPNcNE3cRpCnrR23RrzqxVsGL8',
  'AIzaSyC8FFU_B-CTquIIDq8tWx3jYk5sS44dtHQ',
  'AIzaSyCPUhkeKON2VptQP-W3OPGo_z8ls9OPy74',
  'AIzaSyBCwA8luh9aoXTAALn6wI6dGm4SnyGS5mA',
  'AIzaSyCBAMdvLk230waTPMtnqATt6XRPWyBmSP4',
  'AIzaSyBIrUNvlfWZCWk-6h-uYafy7tPgm73XCCk',
  'AIzaSyDJZHf-xYTdhluOsF_RkHvnAfn-fOm9P6U',
  'AIzaSyCRNYheBmvEt62MXdviaFSM7Nnqn4dfqFY',
  'AIzaSyBPKGSIhhyXnJG-lW5qJ04thMaVi7TFTSc',
];

const MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// In-memory rate limiting (resets on worker restart, but sufficient for edge)
const ipLastRequest = new Map();   // IP -> timestamp
const ipDailyCount = new Map();    // IP -> { count, date }
let globalDailyCount = { count: 0, date: '' };
let currentKeyIndex = 0;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(ip, env) {
  const now = Date.now();
  const today = getToday();
  const cooldown = (parseInt(env.COOLDOWN_SECONDS) || 3) * 1000;
  const dailyPerIp = parseInt(env.DAILY_LIMIT_PER_IP) || 30;
  const dailyGlobal = parseInt(env.DAILY_LIMIT_GLOBAL) || 8000;

  // Cooldown check
  const last = ipLastRequest.get(ip);
  if (last && (now - last) < cooldown) {
    const wait = Math.ceil((cooldown - (now - last)) / 1000);
    return { ok: false, error: `クールタイム中です。${wait}秒後にお試しください。`, status: 429 };
  }

  // Per-IP daily limit
  const ipData = ipDailyCount.get(ip) || { count: 0, date: today };
  if (ipData.date !== today) {
    ipData.count = 0;
    ipData.date = today;
  }
  if (ipData.count >= dailyPerIp) {
    return { ok: false, error: `本日の利用上限（${dailyPerIp}回）に達しました。明日またお試しください。`, status: 429 };
  }

  // Global daily limit
  if (globalDailyCount.date !== today) {
    globalDailyCount = { count: 0, date: today };
  }
  if (globalDailyCount.count >= dailyGlobal) {
    return { ok: false, error: 'サーバーの本日の利用上限に達しました。明日またお試しください。', status: 429 };
  }

  return { ok: true };
}

function recordRequest(ip) {
  const now = Date.now();
  const today = getToday();

  ipLastRequest.set(ip, now);

  const ipData = ipDailyCount.get(ip) || { count: 0, date: today };
  if (ipData.date !== today) {
    ipData.count = 0;
    ipData.date = today;
  }
  ipData.count++;
  ipDailyCount.set(ip, ipData);

  if (globalDailyCount.date !== today) {
    globalDailyCount = { count: 0, date: today };
  }
  globalDailyCount.count++;
}

// Round-robin with failover
async function callGemini(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % API_KEYS.length;
    const key = API_KEYS[keyIndex];

    try {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (res.status === 429) {
        // Rate limited on this key, try next
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Gemini error (key ${keyIndex}): ${res.status} ${errText}`);
        continue;
      }

      // Advance round-robin for next request
      currentKeyIndex = (keyIndex + 1) % API_KEYS.length;

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return { ok: false, error: 'AIからの応答が空でした。もう一度お試しください。' };
      }
      return { ok: true, text };
    } catch (e) {
      console.error(`Gemini fetch error (key ${keyIndex}):`, e);
      continue;
    }
  }

  return { ok: false, error: 'すべてのAPIキーが利用上限に達しています。しばらくお待ちください。' };
}

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || 'https://mizuking796.github.io';
  const isAllowed = origin === allowed || origin === 'http://localhost:8080' || origin === 'http://127.0.0.1:8080';
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Only POST
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    // Referrer check
    const referer = request.headers.get('Referer') || '';
    const allowed = env.ALLOWED_ORIGIN || 'https://mizuking796.github.io';
    const isLocalDev = referer.startsWith('http://localhost:') || referer.startsWith('http://127.0.0.1:');
    if (!referer.startsWith(allowed) && !isLocalDev) {
      return Response.json({ error: 'Unauthorized' }, { status: 403, headers });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Rate limit check
    const rateCheck = checkRateLimit(ip, env);
    if (!rateCheck.ok) {
      return Response.json({ error: rateCheck.error }, { status: rateCheck.status, headers });
    }

    // Parse request
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers });
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
      return Response.json({ error: 'Invalid prompt' }, { status: 400, headers });
    }

    // Record request (count toward limits)
    recordRequest(ip);

    // Call Gemini
    const result = await callGemini(prompt);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 502, headers });
    }

    return Response.json({ text: result.text }, { status: 200, headers });
  },
};
