// Netlify Function (JS): Fetch Coinbase Onramp configuration via OnchainKit
// Docs: https://docs.base.org/onchainkit/fund/fetch-onramp-config
//
// Env vars (set in Netlify):
// - ALLOWED_ORIGINS (comma-separated; e.g., "https://powerwallet.finance")
// - CDP_CLIENT_API_KEY
//
exports.handler = async function(event) {
  // ---- CORS handling ----
  const reqOrigin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://powerwallet.finance')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const originAllowed = allowedOrigins.includes(reqOrigin);
  const corsHeaders = {
    'Access-Control-Allow-Origin': originAllowed ? reqOrigin : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  };
  try {
    console.log('[fetch-onramp-config] Method=', event.httpMethod, 'Origin=', reqOrigin || '(none)', 'Allowed=', originAllowed);
  } catch {}
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }
  if (!originAllowed) {
    try { console.log('[fetch-onramp-config] Blocked by CORS: origin not allowed'); } catch {}
    return { statusCode: 403, headers: corsHeaders, body: 'Forbidden: origin not allowed' };
  }

  try {
    const apiKey = (process.env.CDP_CLIENT_API_KEY || '').trim();
    if (!apiKey) {
      try { console.error('[fetch-onramp-config] Missing CDP_CLIENT_API_KEY'); } catch {}
      return { statusCode: 500, headers: corsHeaders, body: 'Missing CDP_CLIENT_API_KEY' };
    }
    try { console.log('[fetch-onramp-config] Using API key present=true length=', apiKey.length); } catch {}
    const { fetchOnrampConfig } = await import('@coinbase/onchainkit/fund');
    
    const data = await fetchOnrampConfig(apiKey);
    try {
      const count = Array.isArray(data && data.countries) ? data.countries.length : 'n/a';
      console.log('[fetch-onramp-config] Success countries=', count);
    } catch {}
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  } catch (e) {
    try { console.error('[fetch-onramp-config] Error:', e && e.message ? e.message : e); } catch {}
    return { statusCode: 500, headers: corsHeaders, body: e && e.message ? e.message : 'Internal Error' };
  }
};


