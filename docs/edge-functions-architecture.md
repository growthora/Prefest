# Edge Functions Architecture

## Nova Base

- `auth-api`
- `profile-api`
- `event-api`
- `ticket-api`
- `match-api`
- `chat-api`
- `admin-api`
- `financial-api`

## Contrato Global

Todas as novas funcoes devem responder no formato:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

ou

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descricao clara"
  }
}
```

## Shared Layer

- `supabase/functions/_shared/http.ts`: envelope de resposta, parse de body, utilitarios de rota.
- `supabase/functions/_shared/middleware.ts`: auth, roles, service client, logging estruturado e integracao com rate limit.
- `supabase/functions/_shared/rateLimit.ts`: limitacao por endpoint + `userId` + IP.
- `supabase/functions/_shared/legacyProxy.ts`: ponte controlada para funcoes legadas ainda reutilizadas por dominios novos.

## Dominios Ja Migrados

- `auth-api`
  - `POST /register/check`
  - `POST /signup/sync-roles`
  - `PUT /password`
- `profile-api`
  - `GET /me`
  - `PUT /me`
  - `GET /me/checkout`
  - `GET /me/match-gender-preference`
  - `GET /genders`
  - `GET /public/:userId`
  - `GET /match-participation/:eventId/:targetUserId`
- `event-api`
  - `GET /categories`
  - `GET /upcoming-categories`
  - `GET /public`
  - `GET /public/slug/:slug`
  - `GET /public/:id`
  - `GET /trending`
  - `GET /new`
  - `GET /category/:category`
  - `GET /location`
  - `GET /organizer/managed-id`
  - `GET /organizer/:creatorId/events`
  - `GET /organizer/:organizerId/upcoming`
  - `GET /participant/:userId`
  - `GET /likes/user/:userId`
  - `POST /requests`
  - `GET /`
  - `POST /`
  - `GET /slug/:slug`
  - `GET /:id`
  - `PUT /:id`
  - `DELETE /:id`
  - `POST /:id/deactivate`
  - `POST /:id/reactivate`
  - `GET /:id/images`
  - `GET /public/:id/images`
  - `PUT /:id/images`
  - `GET /:id/participants`
  - `GET /:id/singles`
  - `GET /:id/match-candidates`
  - `GET /:id/attendees`
  - `GET /:id/scan-logs`
  - `POST /likes/:eventId/toggle`
  - `GET /likes/:eventId/status`
- `ticket-api`
  - `GET /event/:eventId/types`
  - `GET /event/:eventId/types/organizer`
  - `POST /event/:eventId/types/bulk`
  - `POST /event/:eventId/types`
  - `GET /types/:ticketTypeId`
  - `PUT /types/:ticketTypeId`
  - `DELETE /types/:ticketTypeId`
  - `GET /participants/:eventId`
  - `POST /participants/join`
  - `DELETE /participants/:eventId`
  - `GET /user/:userId`
  - `GET /:ticketId`
  - `POST /validate`
  - `POST /validate-scan`
  - `POST /validate-manual`
  - `GET /payment-status/:ticketId`
  - `GET /coupons`
  - `GET /coupons/validate`
  - `POST /coupons/apply`
  - `GET /coupons/usage`
  - `POST /checkout`
  - `POST /free`
- `admin-api`
  - `GET /settings`
  - `GET /coupons`
  - `POST /coupons`
  - `PUT /coupons/:id`
  - `DELETE /coupons/:id`
  - `GET /coupons/usage`
  - `GET /event-requests`
  - `PUT /event-requests/:id`
  - `DELETE /event-requests/:id`
  - `GET /users`
  - `GET /users/with-stats`
  - `GET /users/pending-organizers`
  - `GET /users/organizer-options`
  - `GET /users/statistics`
  - `GET /users/by-username/:username`
  - `GET /users/:id`
  - `POST /users`
  - `PUT /users/:id`
  - `DELETE /users/:id`
  - `PUT /users/:id/password`
  - `PUT /users/:id/organizer-status`
  - `POST /users/:id/request-organizer-access`
  - `GET /users/:id/team-organizer`
  - `PUT /users/:id/team-organizer`
  - `DELETE /users/:id/team-organizer`
- `chat-api`
  - `GET /messages`
  - `POST /send`
  - `POST /presence`
  - `GET /presence/:userId`
  - `POST /match/:matchId`
  - `DELETE /match/:matchId`
  - `POST /read`
- `match-api`
  - `POST /like`
  - `POST /dislike`
  - `GET /list`
  - `GET /details/:matchId`
  - `GET /event/:eventId/list`
  - `POST /seen`
  - `POST /chat-opened`
  - `GET /likes/summary`
  - `GET /likes/received`
  - `GET /likes/unread`
  - `GET /potential`
  - `GET /candidates`
  - `GET /event-likes`
  - `POST /opt-in`
  - `POST /reset-queue`
  - `POST /skip`
  - `GET /notifications`
  - `DELETE /notifications/:id`
- `financial-api`
  - `GET /overview`
  - `GET /sales`
  - `GET /transactions`
  - `GET /chart`
  - `GET /asaas/account`
  - `PUT /asaas/account`

## Funcoes Legadas Classificadas

### Webhook

- `asaas-webhook`
- `asaas-webhook-handler`
- `uptimerobot-status`

### Interno

- `save-system-settings`
- `test-smtp-connection`
- `delete-user-account`
- `admin-financial-dashboard`
- `organizer-manage-team`
- `complete-profile`
- `debug-auth`
- `refund-requests`

### Legado

- `events-api`
- `admin-update-user-password`
- `admin-delete-user`
- `create-asaas-payment`
- `asaas-create-payment-split`
- `asaas-connect-organizer-v2`
- `asaas-create-or-connect-organizer`
- `asaas-create-ticket-payment-v2`
- `validate-asaas-credentials`
- `fix-team-user-state`
- `mcp`
- `delete-event-safely`

## Legado Controlado

- `init-ticket-checkout-v2`, `save-buyer-profile-v2`, `issue-free-ticket-v2` e `asaas-create-ticket-payment-v3` seguem ativos e fora do `events-api`.
- O frontend atual ainda usa esses fluxos legados de compra por estabilidade operacional, embora `ticket-api` ja esteja publicado.
- As rotas `POST /ticket-api/checkout` e `POST /ticket-api/free` foram reservadas para a consolidacao final sem quebra de contrato.
- `admin-financial-dashboard`, `save-system-settings`, `test-smtp-connection`, `complete-profile` e `refund-requests` agora ficam conectadas por wrappers nos dominios novos, sem uso direto no frontend.
- O frontend ainda chama diretamente apenas `delete-user-account` e `debug-auth`, por serem funcoes dedicadas e fora do escopo dos dominios centrais.

## Politica De Desligamento

- Nao remover webhook sem validar dependencia externa.
- Nao remover funcao interna sem migrar todos os chamadores do frontend e jobs.
- Remover funcoes legadas somente apos confirmar ausencia de trafego e ausencia de referencias no codigo.
