
import { supabase } from '@/lib/supabase';

interface InvokeOptions {
  body?: any;
  headers?: { [key: string]: string };
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
}

/**
 * Helper padronizado para chamar Supabase Edge Functions.
 * Garante que o token de autenticação seja SEMPRE enviado no header Authorization.
 * Substitui chamadas diretas a supabase.functions.invoke para maior segurança e consistência.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    // 1. Obter sessão atual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (sessionError || !token) {
      console.warn(`[apiClient] Tentativa de chamada à função '${functionName}' sem sessão ativa.`);
      throw new Error('Usuário não autenticado');
    }

    // 2. Invocar função com header Authorization explícito
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options.body,
      method: options.method || 'POST',
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`, // Garante o envio do token
      },
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
