# Guia de Configuração SMTP para Autenticação (Supabase Auth)

O sistema de cadastro e login utiliza o serviço de autenticação nativo do Supabase (`supabase.auth`). 
Os logs indicam que o envio de emails de confirmação está falhando devido ao limite de taxa (`Rate Limit`) do serviço de email padrão do Supabase, que é restrito para projetos gratuitos/não verificados (aprox. 3 emails/hora).

## Solução: Configurar SMTP Próprio no Painel do Supabase

Para resolver o problema de "Email não enviado" ou "Limite excedido", você deve configurar um provedor de email externo (como Resend, SendGrid, AWS SES) diretamente no painel do Supabase.

**A tabela `smtp_settings` do banco de dados NÃO é utilizada para emails de autenticação (cadastro/login/reset de senha). Ela serve apenas para emails transacionais da aplicação (ingressos, notificações).**

### Passo a Passo:

1.  Acesse o Painel do seu Projeto no Supabase (https://supabase.com/dashboard/project/_).
2.  No menu lateral esquerdo, vá em **Project Settings** (ícone de engrenagem).
3.  Selecione **Authentication** > **SMTP Settings**.
4.  Ative a opção **Enable Custom SMTP**.
5.  Preencha com as credenciais do seu provedor de email:
    *   **Sender Email**: O email que aparecerá como remetente (ex: `noreply@prefest.com.br`).
    *   **Sender Name**: O nome do remetente (ex: `PreFest`).
    *   **Host**: O endereço do servidor SMTP (ex: `smtp.resend.com`).
    *   **Port**: A porta SMTP (geralmente `465` ou `587`).
    *   **Username**: O usuário SMTP (ex: `resend`).
    *   **Password**: A senha ou chave de API do SMTP.
6.  Clique em **Save**.

### Recomendação de Provedor Gratuito (Resend)

Recomendamos o **Resend** (https://resend.com) pois oferece um plano gratuito generoso (3.000 emails/mês) e excelente entregabilidade.

1.  Crie uma conta no Resend.
2.  Adicione e verifique seu domínio.
3.  Gere uma API Key.
4.  Use as credenciais no Supabase:
    *   Host: `smtp.resend.com`
    *   Port: `465`
    *   User: `resend`
    *   Pass: `re_12345...` (Sua API Key)

### Verificando Logs

Se após configurar o SMTP o problema persistir, verifique os logs de autenticação no painel do Supabase em **Authentication** > **Logs** para identificar erros de credenciais ou bloqueios.
