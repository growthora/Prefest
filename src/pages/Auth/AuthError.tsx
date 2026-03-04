import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';

export const AuthError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorDetails, setErrorDetails] = useState({
    title: 'Erro de Autenticação',
    message: 'Ocorreu um erro ao processar sua solicitação.',
    action: 'Voltar para o início',
    path: ROUTE_PATHS.HOME
  });

  useEffect(() => {
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    if (errorCode === 'otp_expired') {
      setErrorDetails({
        title: 'Link expirado ou inválido',
        message: 'Este link de verificação é inválido ou já expirou. Por motivos de segurança, links de redefinição possuem tempo limitado. Solicite um novo link para continuar.',
        action: 'Solicitar novo link',
        path: ROUTE_PATHS.FORGOT_PASSWORD
      });
    } else if (errorCode === '404' || errorDescription?.includes('Email link is invalid')) {
      // Catch-all for invalid links that might not send otp_expired
      setErrorDetails({
        title: 'Link expirado ou inválido',
        message: 'Este link de verificação é inválido ou já expirou. Por motivos de segurança, links de redefinição possuem tempo limitado. Solicite um novo link para continuar.',
        action: 'Solicitar novo link',
        path: ROUTE_PATHS.FORGOT_PASSWORD
      });
    } else if (searchParams.get('error') === 'access_denied') {
      setErrorDetails({
        title: 'Acesso Negado',
        message: 'O acesso foi negado por segurança. Se você estava tentando redefinir sua senha, solicite um novo link.',
        action: 'Solicitar novo link',
        path: ROUTE_PATHS.FORGOT_PASSWORD
      });
    } else if (errorCode === 'invalid_token') {
       setErrorDetails({
        title: 'Código Inválido',
        message: 'O código informado é inválido ou já foi utilizado.',
        action: 'Tentar novamente',
        path: ROUTE_PATHS.LOGIN
      });
    } else {
      // Fallback
      setErrorDetails({
        title: 'Erro de Autenticação',
        message: errorDescription?.replace(/\+/g, ' ') || 'Ocorreu um erro ao validar sua solicitação.',
        action: 'Voltar para o início',
        path: ROUTE_PATHS.HOME
      });
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md border-red-100 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-700">{errorDetails.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <CardDescription className="text-base text-gray-600">
            {errorDetails.message}
          </CardDescription>
          
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
            onClick={() => navigate(errorDetails.path)}
          >
            {errorDetails.action === 'Solicitar novo link' ? <RefreshCw className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {errorDetails.action}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

