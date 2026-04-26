-- Migrace: Chybí vozíky + nullable completed_at
-- Pusť v Supabase SQL editoru.
--
-- Logika:
--   carts_missing = FALSE → všechno OK, completed_at zůstane NULL
--   carts_missing = TRUE  → chyběly vozíky, operátor zapsal čas hotovo (HH:MM)
-- Statistika zpoždění = AVG(created_at - completed_at) WHERE carts_missing = TRUE.

-- 1) Nový sloupec (default FALSE, aby stávající řádky neshodily insert)
ALTER TABLE transmissions
  ADD COLUMN IF NOT EXISTS carts_missing BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) completed_at musí umět NULL (dosud NOT NULL)
ALTER TABLE transmissions
  ALTER COLUMN completed_at DROP NOT NULL;

-- 3) Datová konzistence: u existujících řádků, které mají completed_at,
--    předpokládáme, že vozíky chyběly. Kdo nemá completed_at → všechno OK.
UPDATE transmissions
  SET carts_missing = TRUE
  WHERE completed_at IS NOT NULL AND carts_missing = FALSE;

-- 4) Index pro rychlé filtrování / statistiku
CREATE INDEX IF NOT EXISTS idx_transmissions_carts_missing
  ON transmissions(carts_missing)
  WHERE carts_missing = TRUE;

-- 5) Ukázkový SELECT pro statistiku (spustit si kdykoli manuálně):
-- SELECT
--   COUNT(*)                                                  AS pocet_s_vozici,
--   AVG(EXTRACT(EPOCH FROM (created_at - completed_at))/60)   AS prumer_zpozdeni_min,
--   MAX(EXTRACT(EPOCH FROM (created_at - completed_at))/60)   AS max_zpozdeni_min
-- FROM transmissions
-- WHERE carts_missing = TRUE AND completed_at IS NOT NULL;
