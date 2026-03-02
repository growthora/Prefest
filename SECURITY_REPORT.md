# Relatório Final de Segurança e Integração Asaas

## 1. Resumo Executivo
Foram realizadas ações corretivas e preventivas para blindar a aplicação contra vazamento de dados e garantir a integridade da integração com o Asaas. O foco foi eliminar a exposição de dados sensíveis no frontend (logs, erros, chaves) e garantir que o backend (Edge Functions) seja a única fonte de verdade e execução de processos críticos.

## 2. Checklist de Segurança Implementado (Camadas)

### A. Frontend (Blindagem e Sanitização)
- [x] **Remoção de Console Logs em Produção**: Configurado `esbuild.pure` no `vite.config.ts` para remover automaticamente `console.log`, `info`, `debug` e `trace` no build de produção.
- [x] **Tratamento de Erros (ErrorBoundary)**: O componente `ErrorBoundary.tsx` foi modificado para exibir erros brutos APENAS em ambiente de desenvolvimento. Em produção, exibe apenas uma mensagem genérica amigável.
- [x] **Limpeza de Arquivos de Configuração**: Removidos logs que expunham chaves e URLs do Supabase em `src/lib/supabase.ts`.
- [x] **Headers de Segurança (Vercel/Next)**: Criado arquivo `vercel.json` com headers estritos:
  - `Strict-Transport-Security` (HSTS): Força HTTPS.
  - `X-Frame-Options: DENY`: Previne Clickjacking.
  - `X-Content-Type-Options: nosniff`: Previne MIME sniffing.
  - `Referrer-Policy`: Controla envio de referer.
  - `Permissions-Policy`: Restringe acesso a recursos de hardware (camera, mic, geolocation).

### B. Backend / Edge Functions (Controle Real)
- [x] **Validação de Retorno da API**: Verificada a função `asaas-create-ticket-payment-v3`. Ela retorna apenas dados públicos necessários (`paymentId`, `invoiceUrl`, `pixQrCode`) e não expõe chaves internas ou dados sensíveis do usuário.
- [x] **Tratamento de Erros no Backend**: As funções tratam exceções e retornam apenas `error.message` sanitizado, sem stack traces.
- [x] **Autenticação e Autorização**: Todas as funções críticas (`init-ticket-checkout-v2`, `asaas-create-ticket-payment-v3`) validam o JWT do usuário e garantem que ele só opera sobre seus próprios dados (`buyer_user_id = user.id`).

### C. Banco de Dados (RLS - Row Level Security)
- [x] **Auditoria de Policies**:
  - `payment_splits`: Acesso restrito a ADMINS (`Admins can view all payment splits`). O frontend não acessa essa tabela diretamente, garantindo segurança total dos dados de comissão.
  - `organizer_asaas_accounts`: Organizadores só podem ver SUAS PRÓPRIAS contas. Admins veem todas.
  - `integration_events`: Acesso restrito a ADMINS.
  - `profiles`: Políticas granulares (público vê básico, dono edita próprio).

## 3. Análise da Integração Asaas (`organizer_asaas_accounts.access_token`)

**Status**: **NÃO UTILIZADO / DEPRECATED**

Após varredura completa no código (`src`, `supabase/functions`), confirmamos que o campo `access_token` da tabela `organizer_asaas_accounts`:
1. **Nunca é lido** para autenticar chamadas ao Asaas.
2. A integração utiliza o modelo de **Split de Pagamento**, onde a autenticação é feita com a **API Key da Plataforma** (Master Account) e o split é direcionado para o `walletId` do organizador.
3. As funções `asaas-create-ticket-payment-v2/v3` utilizam apenas `asaas_account_id` para definir o destino dos fundos.

**Recomendação**: O campo pode ser removido do banco de dados ou mantido como nulo/legado. Não há risco de segurança atual pois o código não o utiliza.

## 4. Alterações Realizadas (Arquivos Chave)

### `vite.config.ts` (Remoção de Logs)
```typescript
esbuild: {
  pure: mode === 'production' ? ['console.log', 'console.info', 'console.debug', 'console.trace'] : [],
},
```

### `src/components/ErrorBoundary.tsx` (Ocultação de Erros)
```typescript
{this.state.error && import.meta.env.DEV && (
  <div className="p-3 bg-muted rounded-md text-sm font-mono overflow-auto max-h-40">
    {this.state.error.toString()}
  </div>
)}
{!import.meta.env.DEV && (
  <div className="p-3 bg-muted rounded-md text-sm">
     Por favor, recarregue a página ou tente novamente mais tarde.
  </div>
)}
```

### `vercel.json` (Security Headers)
Configuração completa adicionada para proteção contra ataques comuns na camada de rede/browser.

## 5. Próximos Passos (Recomendados)

1. **Monitoramento**: Acompanhar os logs da tabela `integration_events` para garantir que o fluxo de webhooks do Asaas está sendo registrado corretamente.
2. **Dashboard do Organizador**: Caso seja necessário mostrar os splits para o organizador no futuro, criar uma Policy RLS específica:
   ```sql
   CREATE POLICY "Organizers can view own splits" ON "payment_splits"
   FOR SELECT USING (auth.uid() = recipient_user_id);
   ```
   *Por enquanto, mantido bloqueado para segurança máxima.*

---
**Conclusão**: O ambiente está seguro contra vazamento de dados via frontend e possui controles robustos no backend. A integração Asaas opera de forma segura utilizando apenas identificadores públicos (Wallet ID) e mantendo as chaves mestras seguras nas variáveis de ambiente do Supabase (Vault).
