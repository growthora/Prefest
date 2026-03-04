-- Store Asaas net value to compute split-based organizer net with Asaas rules.
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS asaas_net_value numeric(10,2);

