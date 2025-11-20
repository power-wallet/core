// Netlify Function (JS): Create Coinbase Onramp session token
// Env vars (set in Netlify):
// - CDP_SECRET_API_KEY (server-side secret API key)
// - CDP_PROJECT_ID (CDP Project ID)

// Use dynamic import to load ESM-compatible CDP SDK in Netlify Functions runtime

exports.handler = async function(event) {
  // ---- CORS handling (lock to exact origins) ----
  const reqOrigin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://powerwallet.finance')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const originAllowed = allowedOrigins.includes(reqOrigin);
  const corsHeaders = {
    'Access-Control-Allow-Origin': originAllowed ? reqOrigin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const apiKeyId = (process.env.CDP_API_KEY || '').trim();
    const secret = (process.env.CDP_SECRET_API_KEY || '').trim();
    const projectId = process.env.CDP_PROJECT_ID || process.env.NEXT_PUBLIC_CDP_PROJECT_ID || '';
    if (!secret || !projectId) {
      return { statusCode: 500, headers: corsHeaders, body: 'Missing CDP configuration' };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const requestedAddress = (body.address || '').trim();
    const userFiat = (body.fiatCurrency || '').trim().toUpperCase();
    const partnerUserRefInput = (body.partnerUserRef || '').trim();

    // viem imports
    const { isAddress, getAddress, createPublicClient, http } = await import('viem');
    const { mainnet } = await import('viem/chains');
    
    // ---- Require Bearer JWT from frontend (CDP recommendation) ----
    const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized' };
    }
    const token = authHeader.slice(7).trim();
    const { jwtVerify, createRemoteJWKSet } = await import('jose');
    const issuer = (process.env.APP_JWT_ISSUER || '').trim() || undefined;
    const audience = (process.env.APP_JWT_AUDIENCE || '').trim() || undefined;
    const jwksUrl = (process.env.APP_JWT_JWKS_URL || '').trim();
    const appSecret = (process.env.APP_JWT_SECRET || '').trim();
    let claims;
    try {
      if (jwksUrl) {
        const JWKS = createRemoteJWKSet(new URL(jwksUrl));
        const verified = await jwtVerify(token, JWKS, { issuer, audience });
        claims = verified.payload;
      } else if (appSecret) {
        const key = new TextEncoder().encode(appSecret);
        const verified = await jwtVerify(token, key, { issuer, audience });
        claims = verified.payload;
      } else {
        return { statusCode: 500, headers: corsHeaders, body: 'Missing auth verification config' };
      }
    } catch (e) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: invalid token' };
    }
    // Optional origin claim binding
    if (claims && claims.origin && claims.origin !== reqOrigin) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: origin mismatch' };
    }
    // Determine and validate address from token/body
    const tokenAddr = ((claims && (claims.address || claims.addr || claims.wallet || claims.sub)) || '').toString().trim();
    const candidateAddr = tokenAddr || requestedAddress;
    if (!candidateAddr || !isAddress(candidateAddr)) {
      return { statusCode: 400, headers: corsHeaders, body: 'Invalid or missing address (JWT or body)' };
    }
    const checksumAddress = getAddress(candidateAddr);
    if (requestedAddress && isAddress(requestedAddress) && getAddress(requestedAddress) !== checksumAddress) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized: address mismatch' };
    }
    const issuedAt = (claims && typeof claims.iat === 'number') ? claims.iat : Math.floor(Date.now() / 1000);

    // ---- On-chain whitelist check ----
    const rpcUrl = (process.env.ETHEREUM_RPC_URL || 'https://mainnet.base.org').trim();
    if (!rpcUrl) {
      return { statusCode: 500, headers: corsHeaders, body: 'Missing ETHEREUM_RPC_URL' };
    }
    const walletFactory = (process.env.WALLET_FACTORY_ADDRESS || '0xfB1b64e658Cd1A7DdcEF9Cf263dFd800fc708987').trim();
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    const walletFactoryAbi = [
      {
        type: 'function',
        stateMutability: 'view',
        name: 'isWhitelisted',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }]
      }
    ];
    let isAllowed = false;
    try {
      isAllowed = await client.readContract({
        address: walletFactory,
        abi: walletFactoryAbi,
        functionName: 'isWhitelisted',
        args: [checksumAddress],
      });
    } catch (e) {
      return { statusCode: 502, headers: corsHeaders, body: 'Whitelist check failed' };
    }
    if (!isAllowed) {
      return { statusCode: 403, headers: corsHeaders, body: 'Forbidden: address not whitelisted' };
    }

    // ---- Derive redirect origin from headers ----
    const xfProto = (event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https';
    const xfHost = (event.headers && (event.headers['x-forwarded-host'] || event.headers['X-Forwarded-Host'])) || (event.headers && event.headers.host) || '';
    const redirectOrigin = process.env.FRONTEND_ORIGIN || (xfHost ? `${xfProto}://${xfHost}` : undefined);

    // Best-effort client IP for security checks (if required)
    const clientIp = (event.headers && (event.headers['x-nf-client-connection-ip'] || event.headers['x-client-ip']))
      || (event.headers && (event.headers['x-forwarded-for'] || '')).split(',')[0].trim()
      || undefined;

    // v2 Create Onramp Session payload for Hosted UI Onramp
    // TODO: add partnerUserRef
    const payload = {
      destinationAddress: checksumAddress,
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
    let cdpHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    cdpHeaders.Authorization = `Bearer ${jwt}`;
    
    const endpoint = process.env.CDP_ONRAMP_API_URL || 'https://api.cdp.coinbase.com/platform/v2/onramp/sessions';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: cdpHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body: `CDP error (${res.status}): ${text || res.statusText}`,
      };
    }
    const data = await res.json();
    const url = (data && data.session && data.session.onrampUrl) || undefined;
    if (!url) {
      return { statusCode: 502, headers: corsHeaders, body: `CDP error: missing onrampUrl in response: ${JSON.stringify(data)}` };
    }

    // Optionally append partnerUserRef
    let finalUrl = url;
    try {
      const u = new URL(url);
      const partnerUserRef = partnerUserRefInput || `${checksumAddress}:${issuedAt}`;
      u.searchParams.set('partnerUserRef', partnerUserRef);
      finalUrl = u.toString();
    } catch (_) {
      // leave as-is if URL parsing fails
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ onrampUrl: finalUrl }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: e && e.message ? e.message : 'Internal Error' };
  }
};


