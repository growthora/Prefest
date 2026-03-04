-- Add support for offline events.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Backfill existing rows.
UPDATE public.events
SET is_active = true
WHERE is_active IS NULL;

-- Enforce non-null going forward.
ALTER TABLE public.events
ALTER COLUMN is_active SET NOT NULL;
