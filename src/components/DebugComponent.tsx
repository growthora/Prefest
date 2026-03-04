import { useEffect } from 'react';

export const DebugComponent = () => {
  useEffect(() => {
    // console.log('ðŸŽ¯ DebugComponent montado!');
    // console.log('ðŸ“ Location:', window.location.href);
    // console.log('ðŸ”— Hash:', window.location.hash);
  }, []);

  return (
    <div className="p-8 bg-green-100 text-green-900">
      <h1 className="text-2xl font-bold">âœ… App está funcionando!</h1>
      <p>Se você vê esta mensagem, o React está renderizando corretamente.</p>
      <p className="mt-4">URL: {window.location.href}</p>
      <p>Hash: {window.location.hash || '(vazio)'}</p>
    </div>
  );
};

