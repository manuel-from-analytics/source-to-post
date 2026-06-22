CREATE OR REPLACE FUNCTION public.autofill_post_title()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  flat text;
  first_sentence text;
BEGIN
  IF NEW.content IS NULL OR btrim(NEW.content) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.title IS NOT NULL AND btrim(NEW.title) <> '' THEN
    RETURN NEW;
  END IF;

  flat := btrim(regexp_replace(NEW.content, E'[\\r\\n]+', ' ', 'g'));
  flat := regexp_replace(flat, '\s+', ' ', 'g');
  first_sentence := btrim(split_part(flat, '.', 1));

  IF length(first_sentence) BETWEEN 8 AND 80 THEN
    NEW.title := first_sentence;
  ELSE
    NEW.title := btrim(regexp_replace(left(flat, 70), '\s+\S*$', '', 'g')) || '…';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS autofill_post_title_trg ON public.generated_posts;
CREATE TRIGGER autofill_post_title_trg
BEFORE INSERT OR UPDATE OF title, content ON public.generated_posts
FOR EACH ROW
EXECUTE FUNCTION public.autofill_post_title();