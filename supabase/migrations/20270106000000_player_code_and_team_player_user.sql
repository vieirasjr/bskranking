-- ============================================================
-- Migration: player_code em basquete_users + user_id em team_players
-- Permite buscar jogadores por código único/nome/email ao inscrever
-- equipes em torneios. O jogador precisa estar cadastrado no app.
-- ============================================================

-- 1. Coluna player_code (6 chars alfanuméricos, único)
-- Se já existir com tipo menor (ex.: VARCHAR(4) de script legado),
-- converte para TEXT antes de tentar salvar códigos de 6 chars.
ALTER TABLE public.basquete_users
  ADD COLUMN IF NOT EXISTS player_code TEXT;

ALTER TABLE public.basquete_users
  ALTER COLUMN player_code TYPE TEXT;

-- Garante unicidade mesmo que a coluna pré-existisse sem UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'basquete_users'
      AND indexdef ILIKE '%UNIQUE%player_code%'
  ) THEN
    CREATE UNIQUE INDEX basquete_users_player_code_unique
      ON public.basquete_users (player_code);
  END IF;
END $$;

-- 2. Função geradora de código (evita 0/O/I/1 para reduzir confusão)
CREATE OR REPLACE FUNCTION public.generate_player_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substring(
      chars FROM (floor(random() * length(chars))::int + 1) FOR 1
    );
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Trigger: ao inserir um basquete_users, se não tiver código, gera um
CREATE OR REPLACE FUNCTION public.assign_player_code()
RETURNS TRIGGER AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
  exists_code BOOLEAN;
BEGIN
  IF NEW.player_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    code := public.generate_player_code();
    SELECT EXISTS (
      SELECT 1 FROM public.basquete_users WHERE player_code = code
    ) INTO exists_code;
    IF NOT exists_code THEN
      NEW.player_code := code;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 15 THEN
      RAISE EXCEPTION 'Falha ao gerar player_code único';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS basquete_users_player_code ON public.basquete_users;
CREATE TRIGGER basquete_users_player_code
  BEFORE INSERT ON public.basquete_users
  FOR EACH ROW EXECUTE FUNCTION public.assign_player_code();

-- 4. Backfill: gera código para usuários já existentes
DO $$
DECLARE
  u RECORD;
  code TEXT;
  attempts INT;
BEGIN
  FOR u IN SELECT id FROM public.basquete_users WHERE player_code IS NULL LOOP
    attempts := 0;
    LOOP
      code := public.generate_player_code();
      BEGIN
        UPDATE public.basquete_users
          SET player_code = code
          WHERE id = u.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 15 THEN
          RAISE;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 5. Índice pra busca
CREATE INDEX IF NOT EXISTS basquete_users_display_name_idx
  ON public.basquete_users (lower(display_name));
CREATE INDEX IF NOT EXISTS basquete_users_full_name_idx
  ON public.basquete_users (lower(full_name));

-- 6. team_players.user_id (FK para basquete_users)
ALTER TABLE public.team_players
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.basquete_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_players_user_idx ON public.team_players(user_id);

-- Mesmo atleta não pode aparecer duas vezes na mesma equipe
CREATE UNIQUE INDEX IF NOT EXISTS team_players_team_user_unique
  ON public.team_players(team_id, user_id)
  WHERE user_id IS NOT NULL;
