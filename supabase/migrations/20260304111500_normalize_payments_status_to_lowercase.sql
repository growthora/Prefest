-- Corrige statuses de pagamentos que ficaram em formato incompatível
-- com as métricas financeiras (maiúsculo/variações do Asaas).

UPDATE public.payments
SET status = CASE
  WHEN upper(status) = 'RECEIVED' THEN 'received'
  WHEN upper(status) = 'CONFIRMED' THEN 'confirmed'
  WHEN upper(status) = 'PENDING' THEN 'pending'
  WHEN upper(status) = 'OVERDUE' THEN 'overdue'
  WHEN upper(status) = 'REFUNDED' THEN 'refunded'
  WHEN upper(status) = 'RECEIVED_IN_CASH' THEN 'received'
  WHEN upper(status) IN ('CANCELED', 'CANCELLED', 'DELETED') THEN 'canceled'
  ELSE lower(status)
END
WHERE status IS NOT NULL;

