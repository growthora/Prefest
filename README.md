# PreFest - Plataforma de Eventos

Uma plataforma completa para gerenciamento de eventos, venda de ingressos e interação social entre participantes.

## 🚀 Funcionalidades

### ✅ Autenticação e Usuários
- Cadastro e Login de usuários
- Perfis personalizáveis
- Recuperação de senha

### ✅ Gestão de Eventos
- Criação e edição de eventos
- Venda de ingressos com QR Code
- Painel do organizador com métricas
- Validação de ingressos

### ✅ Social e Interação
- Sistema de "Match" entre participantes
- Chat em tempo real
- Feed de eventos

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Database, Auth, Realtime)
- **Gerenciamento de Estado:** React Query, Zustand

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [NPM](https://www.npmjs.com/) (geralmente vem com o Node.js)

## 🔧 Configuração e Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/PreFest---Plataforma.git
   cd PreFest---Plataforma
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   Crie um arquivo `.env` na raiz do projeto (você pode copiar o `.env.example`) e preencha com suas credenciais do Supabase:
   ```bash
   cp .env.example .env
   ```
   
   No arquivo `.env`, adicione:
   ```env
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
   ```

4. **Execute o projeto**
   ```bash
   npm run dev
   ```

5. **Acesse a aplicação**
   Abra seu navegador em: `http://localhost:8080` (ou a porta indicada no terminal)

## 🗃️ Estrutura do Banco de Dados

Os scripts de migração e configuração do banco de dados estão localizados na pasta `supabase/migrations` e `supabase/`.

## UptimeRobot monitors for Edge Functions

Use this command to create monitors for every folder in `supabase/functions` (except `_shared`):

```bash
npm run uptimerobot:sync-monitors
```

Required environment variables:

```env
UPTIMEROBOT_API_KEY=your_uptimerobot_main_api_key
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
```

Optional environment variables:

```env
SUPABASE_FUNCTIONS_BASE_URL=https://<project-ref>.supabase.co/functions/v1
UPTIMEROBOT_MONITOR_PREFIX=Edge Function
UPTIMEROBOT_MONITOR_INTERVAL=300
UPTIMEROBOT_MONITOR_TIMEOUT=30
UPTIMEROBOT_ACCEPTED_HTTP_STATUSES=200:1_201:1_202:1_204:1_301:1_302:1_307:1_308:1_400:1_401:1_404:1_500:1
```

Notes:
- This script creates HTTP monitors (`type=1`) and applies `UPTIMEROBOT_ACCEPTED_HTTP_STATUSES` to reduce false alerts in protected endpoints.
- Use dry run to preview without creating monitors:

```bash
npm run uptimerobot:sync-monitors -- --dry-run
```

