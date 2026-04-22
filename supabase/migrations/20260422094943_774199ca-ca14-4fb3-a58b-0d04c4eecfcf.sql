-- Tabla de publicaciones por label
CREATE TABLE public.post_label_publications (
  post_id UUID NOT NULL REFERENCES public.generated_posts(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.post_labels(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, label_id)
);

-- Índices auxiliares
CREATE INDEX idx_post_label_pub_post ON public.post_label_publications(post_id);
CREATE INDEX idx_post_label_pub_label ON public.post_label_publications(label_id);

-- RLS
ALTER TABLE public.post_label_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post_label_publications"
ON public.post_label_publications
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.generated_posts
    WHERE generated_posts.id = post_label_publications.post_id
      AND generated_posts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.generated_posts
    WHERE generated_posts.id = post_label_publications.post_id
      AND generated_posts.user_id = auth.uid()
  )
);

-- Trigger: cuando se borra una asignación label↔post, también borrar la publicación correspondiente
CREATE OR REPLACE FUNCTION public.cleanup_label_publications_on_unassign()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.post_label_publications
  WHERE post_id = OLD.post_id AND label_id = OLD.label_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_label_publications_on_unassign
AFTER DELETE ON public.post_label_assignments
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_label_publications_on_unassign();