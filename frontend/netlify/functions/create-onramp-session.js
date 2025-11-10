// Netlify Function (JS): Create Coinbase Onramp session token
// Env vars (set in Netlify):
// - CDP_SECRET_API_KEY (server-side secret API key)
// - CDP_PROJECT_ID (CDP Project ID)

// Use dynamic import to load ESM-compatible CDP SDK in Netlify Functions runtime

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const apiKeyId = (process.env.CDP_API_KEY || '').trim();
    const secret = (process.env.CDP_SECRET_API_KEY || '').trim();
    const projectId = process.env.CDP_PROJECT_ID || process.env.NEXT_PUBLIC_CDP_PROJECT_ID || '';
    if (!secret || !projectId) {
      return { statusCode: 500, body: 'Missing CDP configuration' };
    }
    const body = event.body ? JSON.parse(event.body) : {};
    const toAddress = (body.address || '').trim();
    const userFiat = (body.fiatCurrency || '').trim().toUpperCase();

    // Derive redirect origin from headers
    const xfProto = (event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https';
    const xfHost = (event.headers && (event.headers['x-forwarded-host'] || event.headers['X-Forwarded-Host'])) || (event.headers && event.headers.host) || '';
    const redirectOrigin = process.env.FRONTEND_ORIGIN || (xfHost ? `${xfProto}://${xfHost}` : undefined);

    // Best-effort client IP for security checks (if required)
    const clientIp = (event.headers && (event.headers['x-nf-client-connection-ip'] || event.headers['x-client-ip']))
      || (event.headers && (event.headers['x-forwarded-for'] || '')).split(',')[0].trim()
      || undefined;

    // v2 Create Onramp Session payload for Hosted UI Onramp
    const payload = {
      destinationAddress: toAddress || undefined,
      destinationNetwork: 'base',
      purchaseCurrency: 'USDC',
      redirectUrl: redirectOrigin,
      clientIp,
      // Optional: hint the user's fiat currency (handled by platform)
      paymentCurrency: userFiat || undefined,
    };

    // Generate JWT for authentication
    const { generateJwt } = await import('@coinbase/cdp-sdk/auth');
    const jwt = await generateJwt({
      apiKeyId: apiKeyId,
      apiKeySecret: secret,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: '/platform/v2/onramp/sessions',
      expiresIn: 120,
    });
    
    // Auth header via official v2 JWT (generateJwt)
    let headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    headers.Authorization = `Bearer ${jwt}`;
    
    const endpoint = process.env.CDP_ONRAMP_API_URL || 'https://api.cdp.coinbase.com/platform/v2/onramp/sessions';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        statusCode: res.status,
        body: `CDP error (${res.status}): ${text || res.statusText}`,
      };
    }
    const data = await res.json();
    console.log('CDP onramp session response:', data);
    const url = (data && (
      data.onrampUrl || data.onramp_url || data.url ||
      (data.session && (data.session.onrampUrl || data.session.onramp_url))
    )) || undefined;
    if (!url) {
      return { statusCode: 502, body: `CDP error: missing onrampUrl in response: ${JSON.stringify(data)}` };
    }
    return { statusCode: 200, body: JSON.stringify({ onrampUrl: url }) };
  } catch (e) {
    return { statusCode: 500, body: e && e.message ? e.message : 'Internal Error' };
  }
};


