// Netlify Function (JS): Fetch Coinbase Onramp configuration via OnchainKit
// Docs: https://docs.base.org/onchainkit/fund/fetch-onramp-config
//
// Env vars (set in Netlify):
// - ALLOWED_ORIGINS (comma-separated; e.g., "https://powerwallet.finance")
// - ONCHAINKIT_API_KEY (preferred) or CDP_API_KEY (fallback)
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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }
  if (!originAllowed) {
    return { statusCode: 403, headers: corsHeaders, body: 'Forbidden: origin not allowed' };
  }

  try {
    const apiKey = (process.env.ONCHAINKIT_API_KEY || process.env.CDP_API_KEY || '').trim();
    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders, body: 'Missing ONCHAINKIT_API_KEY/CDP_API_KEY' };
    }
    const { fetchOnrampConfig } = await import('@coinbase/onchainkit/fund');
    const data = await fetchOnrampConfig(apiKey);
    return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: e && e.message ? e.message : 'Internal Error' };
  }
};


