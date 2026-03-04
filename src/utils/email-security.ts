import { EMAIL_CONTEXT, AUTH_EMAIL_PROVIDER } from '@/lib/index';

/**
 * Valida o contexto de envio de email.
 * 
 * REGRA DE OURO: Auth flows != SMTP do banco.
 * Se o contexto for AUTH, devemos usar EXCLUSIVAMENTE o Supabase Auth Nativo.
 * O SMTP do banco é reservado apenas para emails CUSTOM.
 * 
 * @param context O contexto do envio de email (AUTH ou CUSTOM)
 * @throws Error se tentar usar SMTP customizado em contexto de AUTH
 */
export function validateEmailContext(context: EMAIL_CONTEXT): void {
  // Se o contexto for AUTH, verificamos se o provedor global está correto
  if (context === EMAIL_CONTEXT.AUTH) {
    if (AUTH_EMAIL_PROVIDER !== 'SUPABASE') {
      // Isso teoricamente nunca deve acontecer se a constante estiver hardcoded como 'SUPABASE',
      // mas serve como dupla checagem caso alguém mude a configuração.
      const errorMsg = '[SECURITY CRITICAL] Tentativa de usar provedor de email não-nativo para fluxo de Autenticação.';
      // console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Se chegamos aqui, estamos em contexto AUTH e usando provedor SUPABASE.
    // O código chamador deve prosseguir usando APENAS métodos nativos (supabase.auth.*).
    // NÃO deve tentar ler configurações de SMTP do banco.
    return;
  }

  // Se o contexto for CUSTOM, o uso de SMTP do banco é permitido.
  if (context === EMAIL_CONTEXT.CUSTOM) {
    // Aqui poderíamos adicionar validações extras se necessário
    return;
  }
}

/**
 * Verifica se uma operação de email é segura para o contexto atual.
 * Útil para ser chamado antes de invocar qualquer função de envio.
 */
export function assertAuthEmailSafety(): void {
  validateEmailContext(EMAIL_CONTEXT.AUTH);
}



