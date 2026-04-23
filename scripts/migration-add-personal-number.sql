-- =============================================================================
-- MIGRACE: Přidáme sloupec `personal_number` do tabulky `operators`.
-- Sloupec je volitelný (NULLABLE) kvůli už existujícím řádkům.
-- =============================================================================
-- Spusť v Supabase SQL Editoru:
--   https://supabase.com/dashboard/project/gwlwavglmppufvifbrdb/sql/new
-- =============================================================================

ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS personal_number TEXT;

-- Volitelný index — pomůže při vyhledávání operátorů podle os. čísla.
CREATE INDEX IF NOT EXISTS idx_operators_personal_number
  ON operators(personal_number);
