ALTER TABLE public.newsletter_preference_profiles
ADD COLUMN IF NOT EXISTS freshness_months integer;

COMMENT ON COLUMN public.newsletter_preference_profiles.freshness_months IS 'Max age in months for newsletter items. NULL = no freshness filter.';

-- Initialize default to 6 months for the existing "Predeterminado" profiles migrated from legacy preferences
UPDATE public.newsletter_preference_profiles
SET freshness_months = 6
WHERE freshness_months IS NULL
  AND name = 'Predeterminado';