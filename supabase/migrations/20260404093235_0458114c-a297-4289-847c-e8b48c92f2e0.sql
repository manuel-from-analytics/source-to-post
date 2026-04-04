
CREATE TABLE public.newsletters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'es',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own newsletters"
  ON public.newsletters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.newsletter_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  source_type TEXT DEFAULT 'independent',
  imported_to_library BOOLEAN DEFAULT false,
  input_id UUID REFERENCES public.inputs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own newsletter_items"
  ON public.newsletter_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newsletters
    WHERE newsletters.id = newsletter_items.newsletter_id
    AND newsletters.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.newsletters
    WHERE newsletters.id = newsletter_items.newsletter_id
    AND newsletters.user_id = auth.uid()
  ));

CREATE INDEX idx_newsletters_user_id ON public.newsletters(user_id);
CREATE INDEX idx_newsletters_topic ON public.newsletters(topic);
CREATE INDEX idx_newsletter_items_newsletter_id ON public.newsletter_items(newsletter_id);
