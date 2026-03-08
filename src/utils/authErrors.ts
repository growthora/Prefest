
export const translateAuthError = (message: string): string => {
  if (!message) return 'Ocorreu um erro desconhecido.';

  const lowerMsg = message.toLowerCase();

  // Rate limits / Security
  if (lowerMsg.includes('security purposes') && lowerMsg.includes('seconds')) {
    return 'Aguarde alguns segundos antes de tentar novamente, por segurança.';
  }
  if (lowerMsg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';
  }

  // Auth/Login
  if (lowerMsg.includes('invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }
  if (lowerMsg.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado.';
  }
  if (lowerMsg.includes('user not found')) {
    return 'Usuário não encontrado.';
  }

  // OTP / Token
  if (lowerMsg.includes('token has expired') || lowerMsg.includes('otp_expired')) {
    return 'Este código expirou. Solicite um novo email.';
  }
  if (lowerMsg.includes('token is invalid') || lowerMsg.includes('invalid_token')) {
    return 'Código inválido. Verifique e tente novamente.';
  }

  // Generic
  return message;
};

