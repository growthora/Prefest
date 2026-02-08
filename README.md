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
