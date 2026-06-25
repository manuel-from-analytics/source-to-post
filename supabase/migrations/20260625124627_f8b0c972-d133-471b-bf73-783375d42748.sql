
DO $$
DECLARE
  u RECORD;
  pid uuid;
  cid uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.post_labels LOOP
    -- Ensure canonical Personal label
    SELECT id INTO pid FROM public.post_labels
      WHERE user_id = u.user_id AND kind = 'personal'
      ORDER BY created_at LIMIT 1;
    IF pid IS NULL THEN
      INSERT INTO public.post_labels (user_id, name, color, kind)
      VALUES (u.user_id, 'Personal', '#3b82f6', 'personal')
      RETURNING id INTO pid;
    ELSE
      UPDATE public.post_labels
      SET name = 'Personal', color = '#3b82f6'
      WHERE id = pid;
    END IF;

    -- Ensure canonical Empresa label
    SELECT id INTO cid FROM public.post_labels
      WHERE user_id = u.user_id AND kind = 'company'
      ORDER BY created_at LIMIT 1;
    IF cid IS NULL THEN
      INSERT INTO public.post_labels (user_id, name, color, kind)
      VALUES (u.user_id, 'Empresa', '#8b5cf6', 'company')
      RETURNING id INTO cid;
    ELSE
      UPDATE public.post_labels
      SET name = 'Empresa', color = '#8b5cf6'
      WHERE id = cid;
    END IF;

    -- Repoint assignments from any non-canonical label to Personal
    INSERT INTO public.post_label_assignments (post_id, label_id)
    SELECT DISTINCT a.post_id, pid
    FROM public.post_label_assignments a
    JOIN public.post_labels l ON l.id = a.label_id
    WHERE l.user_id = u.user_id
      AND l.id NOT IN (pid, cid)
    ON CONFLICT DO NOTHING;

    -- Repoint publications similarly (keep earliest published_at on conflict)
    INSERT INTO public.post_label_publications (post_id, label_id, published_at)
    SELECT p.post_id, pid, MIN(p.published_at)
    FROM public.post_label_publications p
    JOIN public.post_labels l ON l.id = p.label_id
    WHERE l.user_id = u.user_id
      AND l.id NOT IN (pid, cid)
    GROUP BY p.post_id
    ON CONFLICT DO NOTHING;

    -- Delete all other labels (cascades remove their assignments/publications)
    DELETE FROM public.post_labels
    WHERE user_id = u.user_id
      AND id NOT IN (pid, cid);
  END LOOP;
END $$;
