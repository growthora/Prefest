
import { supabase } from '@/lib/supabase';
import { AUTH_EMAIL_PROVIDER } from '@/lib';

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
      const errorMsg = `[SECURITY] A função '${functionName}' foi bloqueada pois usa SMTP do banco. O projeto está configurado para usar Supabase Auth Nativo (AUTH_EMAIL_PROVIDER='SUPABASE').`;
      
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

  try {
    let token: string | undefined;

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
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body,
      method: options.method || 'POST',
      headers,
    });

    if (error) {
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
      'Content-Type': 'application/json',
    },
  });
}
