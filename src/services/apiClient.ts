
import { supabase } from '@/lib/supabase';
import { AUTH_EMAIL_PROVIDER, EMAIL_CONTEXT } from '@/lib';

interface InvokeOptions {
  body?: any;
  headers?: { [key: string]: string };
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
  requiresAuth?: boolean; // Default: true
}

async function extractEdgeErrorMessage(error: any): Promise<string | null> {
  try {
    const context = error?.context;
    if (!context) return null;
    const cloned = typeof context.clone === 'function' ? context.clone() : context;
    const contentType = cloned?.headers?.get?.('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await cloned.json();
      const jsonMessage = payload?.error || payload?.message;
      if (jsonMessage) return String(jsonMessage);
    }

    const text = await cloned.text?.();
    if (typeof text === 'string' && text.trim().length > 0) {
      return text.trim();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Helper padronizado para chamar Supabase Edge Functions.
 * Garante que o token de autenticação seja SEMPRE enviado no header Authorization (se requiresAuth=true).
 * Substitui chamadas diretas a supabase.functions.invoke para maior segurança e consistência.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: any }> {
  
  // [SECURITY] Bloqueio de funções de email de auth via SMTP do banco
  if (AUTH_EMAIL_PROVIDER === 'SUPABASE') {
    const PROHIBITED_AUTH_FUNCTIONS = [
      'send-password-reset',
      'send-verification-email',
      'send-magic-link',
      'send-invite'
    ];
    
    if (PROHIBITED_AUTH_FUNCTIONS.includes(functionName)) {
      const errorMsg = `[SECURITY] A função '${functionName}' foi bloqueada. Contexto: ${EMAIL_CONTEXT.AUTH}. O projeto está configurado para usar Supabase Auth Nativo (AUTH_EMAIL_PROVIDER='SUPABASE').`;
      
      if (import.meta.env.DEV) {
        // console.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        // console.warn(errorMsg);
        return { data: null, error: new Error('Função de email desativada por política de segurança') };
      }
    }
  }

  const { requiresAuth = true } = options;
  if (!requiresAuth) {
    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
      const method = options.method || 'POST';
      const headers: Record<string, string> = {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        ...(options.headers || {}),
      };

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (options.body && method !== 'GET') {
        const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
        const isStringBody = typeof options.body === 'string';
        const isFormLikeBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

        if (isFormLikeBody || isStringBody) {
          fetchOptions.body = options.body;
        } else {
          if (!hasContentType) {
            headers['Content-Type'] = 'application/json';
          }
          fetchOptions.body = JSON.stringify(options.body);
        }
      }

      const res = await fetch(functionUrl, fetchOptions);
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text().catch(() => null);

      if (!res.ok) {
        const message =
          (payload && typeof payload === 'object' && (payload.error || payload.message)) ||
          (typeof payload === 'string' && payload.trim().length > 0 ? payload.trim() : null) ||
          `Erro ${res.status}`;
        const error = Object.assign(new Error(String(message)), { status: res.status });
        return { data: null, error };
      }

      return { data: payload as T, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  let token: string | undefined;

  try {
    if (requiresAuth) {
      // 1. Obter sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      token = session?.access_token;

      if (sessionError || !token) {
        // console.warn(`[apiClient] Tentativa de chamada à função '${functionName}' sem sessão ativa.`);
        throw new Error('Usuário não autenticado');
      }
    }

    // 2. Preparar headers
    const headers: { [key: string]: string } = {
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`; // Garante o envio do token
    }

    // 3. Invocar função
    const invokeOptions: any = {
      method: options.method || 'POST',
      headers,
    };
    
    // Only add body if it's not a GET request (GET with body is invalid in fetch)
    if (options.body && invokeOptions.method !== 'GET') {
      const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
      const isStringBody = typeof options.body === 'string';
      const isFormLikeBody =
        typeof FormData !== 'undefined' && options.body instanceof FormData;

      if (isFormLikeBody || isStringBody) {
        invokeOptions.body = options.body;
      } else {
        if (!hasContentType) {
          headers['Content-Type'] = 'application/json';
        }
        invokeOptions.body = JSON.stringify(options.body);
      }
    }

    const { data, error } = await supabase.functions.invoke(functionName, invokeOptions);

    if (error) {
      const detailedMessage = await extractEdgeErrorMessage(error);
      if (detailedMessage) {
        error.message = detailedMessage;
      }

      // console.error(`[apiClient] Raw error from ${functionName}:`, error);

      // FASE 6: Tratamento de erro 401 (Sessão Expirada/Inválida)
      // O SDK pode retornar erro como objeto ou string dependendo da versão/falha
      const errorStr = (error.message || '').toLowerCase();
      const errorCode = error.code || error.status;
      const errorJson = JSON.stringify(error).toLowerCase();
      
      const isAuthError = 
        errorStr.includes('invalid jwt') || 
        errorStr.includes('jwt expired') ||
        errorStr.includes('unauthorized') || // Catch-all for "Unauthorized" message
        errorCode === 401 ||                 // Check status code directly
        errorJson.includes('"code":401') ||  // Check JSON structure if stringified
        errorJson.includes('"status":401');

      if (isAuthError) {
         if (requiresAuth && token) {
           try {
             const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
             const directRes = await fetch(functionUrl, {
               method: invokeOptions.method,
               headers: {
                 'Content-Type': 'application/json',
                 apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                 Authorization: `Bearer ${token}`,
                 ...(options.headers || {}),
               },
               body: invokeOptions.method !== 'GET' && options.body ? JSON.stringify(options.body) : undefined,
             });

             const directJson = await directRes.json().catch(() => ({}));
             if (directRes.ok) {
               return { data: directJson as T, error: null };
             }
           } catch {
             // Keep default auth handling below if fallback call fails.
           }
         }
         // console.error(`[apiClient] Erro 401/JWT Inválido na função ${functionName}. Forçando logout.`);
         
         // Limpar sessão local
         await supabase.auth.signOut();
         
         // Redirecionar para login preservando o contexto (se possível)
         if (typeof window !== 'undefined') {
             // Append context to URL if not already present
             const currentPath = window.location.pathname;
             if (!currentPath.includes('/login')) {
                window.location.href = `/login?reason=session_expired&next=${encodeURIComponent(currentPath)}`;
             }
         }
      }
      throw error;
    }

    return { data, error: null };
  } catch (err: any) {
    // console.error(`[apiClient] Erro na função '${functionName}':`, err);
    return { data: null, error: err };
  }
}

/**
 * Wrapper genérico para fetch com autenticação (se necessário para APIs externas ou endpoints customizados).
 * Segue o padrão solicitado pelo usuário.
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) throw new Error('Usuário não autenticado');

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });
}

