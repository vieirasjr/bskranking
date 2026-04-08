-- Add 'suspended' status to players table for temporary bench during match
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_status_check;
ALTER TABLE public.players ADD CONSTRAINT players_status_check
  CHECK (status IN ('waiting', 'team1', 'team2', 'suspended'));
