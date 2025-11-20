// Netlify Function (JS): Mint an app JWT for frontend Authorization
// Env vars (set in Netlify):
// - ALLOWED_ORIGINS (comma-separated list; e.g., "https://powerwallet.finance")
// - APP_JWT_SECRET (HS256 shared secret for signing)
// - APP_JWT_ISSUER (optional)
// - APP_JWT_AUDIENCE (optional)
//
// Request (POST JSON):
// {
//   "address": "0xabc...",
//   "message": "arbitrary string that user signed (suggest include ts=...; origin=...)",
//   "signature": "0x...",
//   "expSec": 300 // optional, default 300
// }
//
// Response:
// { "token": "<JWT>" }
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }
  if (!originAllowed) {
    return { statusCode: 403, headers: corsHeaders, body: 'Forbidden: origin not allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const addressInput = (body.address || '').trim();
    const message = (body.message || '').trim();
    const signature = (body.signature || '').trim();
    const expSec = Number.isFinite(Number(body.expSec)) ? Math.max(60, Math.min(3600, Number(body.expSec))) : 300;

    if (!addressInput || !message || !signature) {
      return { statusCode: 400, headers: corsHeaders, body: 'Missing required fields' };
    }

    const { verifyMessage, isAddress, getAddress } = await import('viem');
    if (!isAddress(addressInput)) {
      return { statusCode: 400, headers: corsHeaders, body: 'Invalid address' };
    }
    const checksumAddress = getAddress(addressInput);

    let verified = false;
    try {
      verified = await verifyMessage({
        address: checksumAddress,
        message,
        signature,
      });
    } catch (_) {
      verified = false;
    }
    if (!verified) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: signature verification failed' };
    }

    // Optional: freshness and origin binding if message carries these hints
    // Expect ts=<unixSeconds> and origin=<origin> in the signed message (semicolon/space separated)
    const tsMatch = /(?:^|\s|;|,)ts=(\d{10})/.exec(message);
    if (tsMatch && tsMatch[1]) {
      const issuedAtHint = parseInt(tsMatch[1], 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - issuedAtHint) > 300) {
        return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: message expired' };
      }
    }
    const originMatch = /(?:^|\s|;|,)origin=([^\s;,]+)/.exec(message);
    if (originMatch && originMatch[1] && originMatch[1] !== reqOrigin) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: origin mismatch' };
    }

    const secret = (process.env.APP_JWT_SECRET || '').trim();
    if (!secret) {
      return { statusCode: 500, headers: corsHeaders, body: 'Server not configured: APP_JWT_SECRET missing' };
    }
    const issuer = (process.env.APP_JWT_ISSUER || '').trim() || undefined;
    const audience = (process.env.APP_JWT_AUDIENCE || '').trim() || undefined;

    const { SignJWT } = await import('jose');
    const key = new TextEncoder().encode(secret);
    const jwt = await new SignJWT({
      address: checksumAddress,
      origin: reqOrigin,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(`${expSec}s`)
      .sign(key);

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ token: jwt }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: e && e.message ? e.message : 'Internal Error' };
  }
};


