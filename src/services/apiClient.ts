
import { supabase } from '@/lib/supabase';
import { AUTH_EMAIL_PROVIDER, EMAIL_CONTEXT } from '@/lib';

interface InvokeOptions {
  body?: any;
  headers?: { [key: string]: string };
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  requiresAuth?: boolean; // Default: true
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
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        console.warn(errorMsg);
        return { data: null, error: new Error('Função de email desativada por política de segurança') };
      }
    }
  }

  const { requiresAuth = true } = options;
  let token: string | undefined;

  try {
    if (requiresAuth) {
      // 1. Obter sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      token = session?.access_token;

      if (sessionError || !token) {
        console.warn(`[apiClient] Tentativa de chamada à função '${functionName}' sem sessão ativa.`);
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
      invokeOptions.body = options.body;
    }

    const { data, error } = await supabase.functions.invoke(functionName, invokeOptions);

    if (error) {
      console.error(`[apiClient] Raw error from ${functionName}:`, error);

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
         console.error(`[apiClient] Erro 401/JWT Inválido na função ${functionName}. Forçando logout.`);
         
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
    console.error(`[apiClient] Erro na função '${functionName}':`, err);
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
