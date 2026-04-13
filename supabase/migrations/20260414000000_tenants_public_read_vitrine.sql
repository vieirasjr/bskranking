-- Vitrine "Quadras e locais" usa embed tenant:tenants(...). Sem leitura pública em
-- tenants, o join vem vazio para anon e o app não mostrava nenhum local.
-- Política extra (OR com a do dono): qualquer um lê tenants em status de vitrine.

CREATE POLICY "tenants_select_public_vitrine" ON public.tenants
  FOR SELECT
  USING (status IN ('trial', 'active', 'past_due'));
