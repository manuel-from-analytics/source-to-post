DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_label_kind') THEN
    CREATE TYPE public.post_label_kind AS ENUM ('personal', 'company', 'other');
  END IF;
END $$;

ALTER TABLE public.post_labels
  ADD COLUMN IF NOT EXISTS kind public.post_label_kind NOT NULL DEFAULT 'other';

UPDATE public.post_labels
SET kind = 'personal'
WHERE lower(btrim(name)) IN ('personal');

UPDATE public.post_labels
SET kind = 'company'
WHERE lower(btrim(name)) IN ('empresa', 'empresas', 'company', 'companies');

-- Ensure only one label per kind per user for personal/company (avoid ambiguity)
CREATE UNIQUE INDEX IF NOT EXISTS post_labels_user_kind_unique
  ON public.post_labels(user_id, kind)
  WHERE kind IN ('personal', 'company');