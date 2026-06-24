ALTER TABLE public.generated_posts
  ADD COLUMN IF NOT EXISTS linkedin_published_at timestamptz;

CREATE TABLE public.scheduled_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.generated_posts(id) on delete cascade,
  target text not null check (target in ('personal','company')),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','publishing','done','failed','cancelled')),
  attempts int not null default 0,
  error text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_publications TO authenticated;
GRANT ALL ON public.scheduled_publications TO service_role;

ALTER TABLE public.scheduled_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own scheduled publications"
  ON public.scheduled_publications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_scheduled_publications
  BEFORE UPDATE ON public.scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX scheduled_publications_due_idx
  ON public.scheduled_publications (status, scheduled_at)
  WHERE status = 'pending';