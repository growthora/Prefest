
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { invokeEdgeFunction } from '@/services/apiClient';

export const DebugAuth = () => {
  const { currentSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // console.log('Testing Debug Auth via invokeEdgeFunction...');
      const { data, error } = await invokeEdgeFunction('debug-auth', { 
        method: 'POST',
        body: { test: true }
      });

      if (error) throw error;
      setResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      // console.error('Debug Auth Error:', err);
      setResult(`ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="container mx-auto p-8 max-w-2xl mt-20">
      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico de Autenticação (Edge Functions)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md">
            <h3 className="font-bold mb-2">Status Local:</h3>
            <p>Sessão Ativa: {currentSession ? '✅ Sim' : '❌ Não'}</p>
            <p className="text-xs text-muted-foreground break-all mt-1">
              User ID: {currentSession?.user?.id || 'N/A'}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-bold">Resultado da Edge Function:</h3>
            <Button onClick={runTest} disabled={loading} size="sm">
              {loading ? 'Testando...' : 'Re-testar'}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-100 text-red-800 rounded-md">
              <strong>Erro na requisição:</strong> {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-slate-900 text-green-400 rounded-md font-mono text-sm overflow-auto">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground mt-4">
            <p><strong>Legenda:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>hasSession: true</strong> - O Supabase recebeu e validou o token com sucesso.</li>
              <li><strong>hasSession: false</strong> - O Supabase recebeu a requisição mas não encontrou um token válido.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugAuth;


