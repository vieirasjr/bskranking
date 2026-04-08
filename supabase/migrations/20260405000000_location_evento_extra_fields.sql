-- Add image and website fields to locations and eventos

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS website TEXT;
