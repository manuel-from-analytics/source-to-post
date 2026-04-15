
-- Labels for posts
CREATE TABLE public.post_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post_labels"
ON public.post_labels FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Junction table
CREATE TABLE public.post_label_assignments (
  post_id UUID NOT NULL REFERENCES public.generated_posts(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.post_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, label_id)
);

ALTER TABLE public.post_label_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post_label_assignments"
ON public.post_label_assignments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.generated_posts
    WHERE generated_posts.id = post_label_assignments.post_id
    AND generated_posts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.generated_posts
    WHERE generated_posts.id = post_label_assignments.post_id
    AND generated_posts.user_id = auth.uid()
  )
);
