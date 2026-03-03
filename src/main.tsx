import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { sanitizeHtml } from '@/lib/sanitize';

// console.log('🎬 main.tsx carregado');
// console.log('🌐 window.location:', window.location.href);

try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error('Elemento root não encontrado no HTML!');
  }
  
  // console.log('📦 Criando root React...');
  const root = createRoot(rootElement);
  
  // console.log('🚀 Renderizando App...');
  root.render(<App />);
  
  // console.log('✅ App renderizado com sucesso!');
} catch (error) {
  // console.error('💥 ERRO CRÍTICO ao inicializar:', error);
  const safeError = sanitizeHtml(String(error));
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif;">
      <h1 style="color: red;">❌ Erro ao carregar aplicação</h1>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${safeError}</pre>
      <p>Abra o Console (F12) para mais detalhes.</p>
    </div>
  `;
}
