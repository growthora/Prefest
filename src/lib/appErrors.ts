export type AppErrorCode =
  | 'EVENT_ENDED'
  | 'EVENT_CANCELED'
  | 'EVENT_SALES_DISABLED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'MIN_TICKET_PRICE_NOT_REACHED'
  | 'TICKET_SOLD_OUT'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'CONFLICT'
  | 'UNKNOWN';

export function translateAppErrorCode(code: AppErrorCode): string {
  switch (code) {
    case 'EVENT_ENDED':
      return 'Este evento já encerrou e não aceita novas compras.';
    case 'EVENT_CANCELED':
      return 'Evento cancelado.';
    case 'EVENT_SALES_DISABLED':
      return 'As vendas para este evento foram desativadas pelo organizador.';
    case 'UNAUTHORIZED':
      return 'Sessão inválida. Faça login novamente.';
    case 'RATE_LIMITED':
      return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    case 'MIN_TICKET_PRICE_NOT_REACHED':
      return 'O valor mínimo para pagamento é de R$ 5,00. Por favor, escolha outro ingresso.';
    case 'TICKET_SOLD_OUT':
      return 'Ingressos esgotados para este tipo.';
    case 'VALIDATION_ERROR':
      return 'Verifique os dados informados e tente novamente.';
    case 'FORBIDDEN':
      return 'Você não tem permissão para realizar esta ação.';
    case 'NETWORK_ERROR':
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    case 'CONFLICT':
      return 'Esta ação não pôde ser concluída porque o recurso já foi alterado.';
    default:
      return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}

function tryParseJson(value: unknown): any {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractCodeFromUnknown(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    if (parsed) {
      return extractCodeFromUnknown(parsed);
    }
    return value;
  }

  if (typeof value === 'object') {
    const candidate = value as any;
    return String(
      candidate?.code ||
      candidate?.error ||
      candidate?.name ||
      candidate?.status ||
      candidate?.statusCode ||
      candidate?.response?.data?.code ||
      candidate?.response?.data?.error ||
      candidate?.context?.body?.code ||
      candidate?.context?.body?.error ||
      ''
    );
  }

  return '';
}

export function getAppErrorCode(err: any): AppErrorCode {
  const rawCode = extractCodeFromUnknown(err);
  const rawMsg = String(
    err?.message ||
    err?.details ||
    err?.hint ||
    err?.context?.body ||
    err?.response?.data?.message ||
    ''
  ).toLowerCase();

  // Supabase Edge invoke errors sometimes carry the response body in context
  const contextBody = err?.context?.body;
  const parsedBody = tryParseJson(contextBody) || contextBody;
  const bodyCode = parsedBody?.code || parsedBody?.error;

  const code = String(bodyCode || rawCode || '').toUpperCase();

  if (code === 'EVENT_ENDED') return 'EVENT_ENDED';
  if (code === 'EVENT_CANCELED') return 'EVENT_CANCELED';
  if (code === 'EVENT_SALES_DISABLED' || code === 'SALES_DISABLED') return 'EVENT_SALES_DISABLED';
  if (code === 'RATE_LIMITED' || code === 'TOO_MANY_REQUESTS') return 'RATE_LIMITED';
  if (code === 'MIN_TICKET_PRICE_NOT_REACHED') return 'MIN_TICKET_PRICE_NOT_REACHED';
  if (code === 'TICKET_SOLD_OUT') return 'TICKET_SOLD_OUT';
  if (code === 'VALIDATION_ERROR') return 'VALIDATION_ERROR';
  if (code === '403' || code === 'FORBIDDEN') return 'FORBIDDEN';
  if (code === '409' || code === 'CONFLICT') return 'CONFLICT';

  if (rawMsg.includes('invalid jwt') || rawMsg.includes('jwt expired') || rawMsg.includes('unauthorized')) {
    return 'UNAUTHORIZED';
  }

  if (rawMsg.includes('forbidden') || rawMsg.includes('insufficient permissions') || rawMsg.includes('permission denied')) {
    return 'FORBIDDEN';
  }

  if (rawMsg.includes('rate limit') || rawMsg.includes('too many requests')) {
    return 'RATE_LIMITED';
  }

  if (rawMsg.includes('missing required fields') || rawMsg.includes('missing required')) {
    return 'VALIDATION_ERROR';
  }

  if (
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('networkerror') ||
    rawMsg.includes('network error') ||
    rawMsg.includes('fetch failed')
  ) {
    return 'NETWORK_ERROR';
  }

  if (
    rawMsg.includes('functionshttperror') ||
    rawMsg.includes('edge function returned a non-2xx status code') ||
    rawMsg.includes('non-2xx status code') ||
    rawMsg.includes('duplicate key') ||
    rawMsg.includes('already exists') ||
    rawMsg.includes('23505')
  ) {
    return 'CONFLICT';
  }

  return 'UNKNOWN';
}

export function toUserFriendlyErrorMessage(err: any): string {
  const code = getAppErrorCode(err);
  return translateAppErrorCode(code);
}
