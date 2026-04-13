-- Imagem larga opcional para o topo da página pública de detalhe (/locais/:slug).
-- Lista/vitrine continua usando image_url; capa usa cover_image_url ou cai para image_url.

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.locations.cover_image_url IS 'URL imagem larga/hero na página pública de detalhe; se nulo, usa image_url';
