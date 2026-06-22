-- Backfill: link existing personal LinkedIn metrics to personal-labeled posts by publication date.
WITH candidates AS (
  SELECT DISTINCT ON (m.id)
    m.id AS metric_id,
    p.id AS post_id
  FROM public.linkedin_post_metrics m
  JOIN public.generated_posts p ON p.user_id = m.user_id
  JOIN public.post_label_assignments pla ON pla.post_id = p.id
  JOIN public.post_labels pl ON pl.id = pla.label_id
  WHERE m.source = 'personal'
    AND m.post_id IS NULL
    AND pl.name = 'Personal'
    AND p.published_at IS NOT NULL
    AND m.posted_at IS NOT NULL
    AND (p.published_at AT TIME ZONE 'UTC')::date = (m.posted_at AT TIME ZONE 'UTC')::date
  ORDER BY m.id, p.published_at DESC
)
UPDATE public.linkedin_post_metrics m
SET post_id = c.post_id
FROM candidates c
WHERE m.id = c.metric_id;