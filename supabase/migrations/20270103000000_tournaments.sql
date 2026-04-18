-- ============================================================
-- Migration: Tournament Module
-- Cria tabela `tournaments` com campos completos para o módulo
-- de torneios (extensão do sistema de eventos, sem substituí-lo).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tournaments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Escopo e visibilidade
  tenant_id             UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id           UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  visibility            TEXT NOT NULL DEFAULT 'tenant'
                        CHECK (visibility IN ('global','tenant','private')),

  -- Identificação
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  logo_url              TEXT,
  description           TEXT,

  -- Datas
  start_date            DATE NOT NULL,
  end_date              DATE,

  -- Responsável
  responsible_name      TEXT,
  responsible_contact   TEXT,

  -- Configuração esportiva
  modality              TEXT NOT NULL
                        CHECK (modality IN ('1x1','3x3','5x5')),
  gender                TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (gender IN ('MALE','FEMALE','MIXED','OPEN')),
  max_teams             INT,

  -- Pagamento (sem gateway nesta fase)
  is_paid               BOOLEAN NOT NULL DEFAULT false,
  price_brl             INT,  -- centavos (ex.: 5000 = R$50,00)

  -- Regras editáveis em markdown (pré-populadas por modalidade no frontend)
  rules_md              TEXT,
  rules_document_url    TEXT,

  -- Ciclo de vida
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','open','closed','in_progress','finished','cancelled')),

  -- Auditoria
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS tournaments_tenant_idx   ON public.tournaments(tenant_id);
CREATE INDEX IF NOT EXISTS tournaments_location_idx ON public.tournaments(location_id);
CREATE INDEX IF NOT EXISTS tournaments_status_idx   ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_slug_idx     ON public.tournaments(slug);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tournaments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournaments_updated_at ON public.tournaments;
CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.tournaments_set_updated_at();

-- RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Leitura pública: torneios não-rascunho são visíveis para todos
-- (necessário para a página pública /torneios/:slug).
CREATE POLICY "tournaments_public_read"
  ON public.tournaments FOR SELECT
  USING (status <> 'draft' OR auth.uid() IS NOT NULL);

-- Escrita: usuários autenticados (checagens finas ficam no cliente/servidor).
-- Segue o padrão permissivo já usado em `eventos`.
CREATE POLICY "tournaments_authenticated_write"
  ON public.tournaments FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
