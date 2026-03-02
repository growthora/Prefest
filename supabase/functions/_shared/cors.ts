
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, idempotency-key, x-application-name, x-client-version, asaas-access-token',
  'Access-Control-Allow-Credentials': 'true',
};

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Regex for Vercel preview deployments and production
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/.*-prefrest-frontend\.vercel\.app$/, // Preview deployments
  /^https:\/\/prefrest-frontend\.vercel\.app$/,     // Production
  /^https:\/\/.*\.supabase\.co$/,                   // Supabase (if needed)
  /^http:\/\/localhost:\d+$/,                       // Any localhost port
  /^http:\/\/127\.0\.0\.1:\d+$/,                    // Any 127.0.0.1 port
];

export const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');
  
  let allowOrigin = '';

  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowOrigin = origin;
    } else {
      for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
        if (pattern.test(origin)) {
          allowOrigin = origin;
          break;
        }
      }
    }
  }

  // Fallback for non-browser requests or unmatching origins (deny or strict)
  // If no match, we don't return the header, effectively blocking CORS in browser
  
  return {
    ...CORS_HEADERS,
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
  };
};

export const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
};
