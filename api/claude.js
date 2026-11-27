// Claude API proksi — faqat Tentart xodimlari uchun.
// Himoya: 1) faqat bizning saytlardan (Origin), 2) Supabase'ga kirgan foydalanuvchi tokeni,
// 3) foydalanuvchi profiles jadvalida bo'lishi (xodim), 4) model va hajm cheklovi.

const SURL = process.env.SUPABASE_URL || 'https://zheszanbqkcckxwnrycu.supabase.co';
// anon key ochiq kalit (brauzerda ham bor) — maxfiy emas
const SKEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZXN6YW5icWtjY2t4d25yeWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTQ3MzksImV4cCI6MjA5MzA3MDczOX0.uzQVIB8gwJ_MnX3-i45d_CwCuhhI3rtS98642kdeKvc';

const ALLOWED_ORIGINS = new Set([
  'https://erp.tentart.uz',
  'https://tentart.uz',
  'https://www.tentart.uz',
  'https://tentart-erp.vercel.app',
]);
const ALLOWED_MODELS = new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_PROMPT_CHARS = 200000;

function originOk(origin) {
  if (!origin) return true; // bir xil saytdan kelgan oddiy so'rovlarda Origin bo'lmasligi mumkin
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Vercel preview: tentart-erp-xxxx.vercel.app
  return /^https:\/\/tentart-erp(-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
}

async function getStaff(token) {
  const h = { apikey: SKEY, Authorization: `Bearer ${token}` };
  const u = await fetch(`${SURL}/auth/v1/user`, { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user?.id) return null;
  const p = await fetch(`${SURL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,rol`, { headers: h });
  if (!p.ok) return null;
  const rows = await p.json();
  return Array.isArray(rows) && rows[0]?.rol ? rows[0] : null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (!originOk(origin)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Avval tizimga kiring' });

  try {
    const staff = await getStaff(token);
    if (!staff) return res.status(401).json({ error: 'Sessiya tugagan yoki ruxsat yo\'q — qayta kiring' });

    const { prompt, systemPrompt, maxTokens, model } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Prompt bo\'sh' });
    if (prompt.length + String(systemPrompt || '').length > MAX_PROMPT_CHARS) {
      return res.status(413).json({ error: 'Matn juda uzun' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL,
        max_tokens: Math.min(Math.max(parseInt(maxTokens) || 2500, 500), 16000),
        system: String(systemPrompt || ''),
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.content?.[0]?.text || 'Xatolik';
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
