-- Permite excluir cupons sem quebrar tickets históricos.
-- Ao remover um cupom, tickets que o referenciam ficam com coupon_id = NULL.

ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_coupon_id_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_coupon_id_fkey
FOREIGN KEY (coupon_id)
REFERENCES public.coupons(id)
ON DELETE SET NULL;

