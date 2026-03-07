-- Event gallery support (1..5 images, ordered, cover image)

CREATE TABLE IF NOT EXISTS public.event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_images_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_event_images_event_id ON public.event_images(event_id);
CREATE INDEX IF NOT EXISTS idx_event_images_order ON public.event_images(event_id, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_images_one_cover_per_event
  ON public.event_images(event_id)
  WHERE is_cover;

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_images_event_display_order
  ON public.event_images(event_id, display_order);

CREATE OR REPLACE FUNCTION public.event_images_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.image_url IS NULL OR btrim(NEW.image_url) = '' THEN
    RAISE EXCEPTION 'image_url is required';
  END IF;

  NEW.image_url := btrim(NEW.image_url);
  NEW.display_order := GREATEST(COALESCE(NEW.display_order, 0), 0);
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_count
    FROM public.event_images ei
    WHERE ei.event_id = NEW.event_id;

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'event_images limit exceeded: max 5 images per event';
    END IF;
  END IF;

  IF COALESCE(NEW.is_cover, false) = false AND NOT EXISTS (
    SELECT 1
    FROM public.event_images ei
    WHERE ei.event_id = NEW.event_id
      AND ei.is_cover = true
      AND (TG_OP = 'INSERT' OR ei.id <> NEW.id)
  ) THEN
    NEW.is_cover := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_images_before_write ON public.event_images;
CREATE TRIGGER trg_event_images_before_write
BEFORE INSERT OR UPDATE ON public.event_images
FOR EACH ROW
EXECUTE FUNCTION public.event_images_before_write();

ALTER TABLE public.event_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_event_images_select_public ON public.event_images;
CREATE POLICY rls_event_images_select_public
ON public.event_images
FOR SELECT
USING (true);

DROP POLICY IF EXISTS rls_event_images_insert_owner_admin ON public.event_images;
CREATE POLICY rls_event_images_insert_owner_admin
ON public.event_images
FOR INSERT
WITH CHECK (public.can_manage_event(event_id, auth.uid()));

DROP POLICY IF EXISTS rls_event_images_update_owner_admin ON public.event_images;
CREATE POLICY rls_event_images_update_owner_admin
ON public.event_images
FOR UPDATE
USING (public.can_manage_event(event_id, auth.uid()))
WITH CHECK (public.can_manage_event(event_id, auth.uid()));

DROP POLICY IF EXISTS rls_event_images_delete_owner_admin ON public.event_images;
CREATE POLICY rls_event_images_delete_owner_admin
ON public.event_images
FOR DELETE
USING (public.can_manage_event(event_id, auth.uid()));
