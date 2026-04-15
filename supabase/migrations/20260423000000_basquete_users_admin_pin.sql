-- PIN de administrador por usuário (4 dígitos numéricos).
-- Cada admin (owner ou co-admin) possui seu próprio PIN para confirmar ações.
ALTER TABLE basquete_users ADD COLUMN IF NOT EXISTS admin_pin TEXT
  CHECK (admin_pin IS NULL OR (admin_pin ~ '^\d{4}$'));
