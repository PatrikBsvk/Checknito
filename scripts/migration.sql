-- =============================================================================
-- Transmise Control — Supabase migration
-- =============================================================================
-- Spusť tento script v Supabase SQL Editoru:
--   https://supabase.com/dashboard/project/gwlwavglmppufvifbrdb/sql/new
-- Stačí zkopírovat celý obsah, vložit a kliknout "Run".
-- =============================================================================

-- 1. Tabulka operátorů
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabulka transmisí
CREATE TABLE IF NOT EXISTS transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmission_number TEXT NOT NULL,
  operator_id UUID REFERENCES operators(id),
  completed_at TIMESTAMP NOT NULL,
  has_errors BOOLEAN DEFAULT FALSE,
  errors JSONB DEFAULT '[]'::jsonb,
  photo_left TEXT,
  photo_right TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

-- 3. Indexy
CREATE INDEX IF NOT EXISTS idx_transmissions_created_by ON transmissions(created_by);
CREATE INDEX IF NOT EXISTS idx_transmissions_archived ON transmissions(archived);
CREATE INDEX IF NOT EXISTS idx_transmissions_created_at ON transmissions(created_at DESC);

-- 4. Zapni Row-Level Security
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;

-- 5. Smaž staré policies (idempotent)
DROP POLICY IF EXISTS "operators_select" ON operators;
DROP POLICY IF EXISTS "operators_insert_admin" ON operators;
DROP POLICY IF EXISTS "operators_delete_admin" ON operators;
DROP POLICY IF EXISTS "transmissions_select" ON transmissions;
DROP POLICY IF EXISTS "transmissions_insert" ON transmissions;
DROP POLICY IF EXISTS "transmissions_update" ON transmissions;
DROP POLICY IF EXISTS "transmissions_delete" ON transmissions;

-- 6. Policies pro operátory
--    Všichni přihlášení uživatelé vidí všechny operátory (pro dropdown ve formuláři)
CREATE POLICY "operators_select" ON operators
  FOR SELECT TO authenticated USING (true);

--    Jen admin může přidávat operátory
CREATE POLICY "operators_insert_admin" ON operators
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

--    Jen admin může mazat operátory
CREATE POLICY "operators_delete_admin" ON operators
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 7. Policies pro transmise
--    Uživatel vidí svoje, admin vidí vše
CREATE POLICY "transmissions_select" ON transmissions
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

--    Uživatel může vkládat jen s vlastním user_id
CREATE POLICY "transmissions_insert" ON transmissions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

--    Uživatel může upravovat svoje, admin vše
CREATE POLICY "transmissions_update" ON transmissions
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

--    Uživatel může mazat svoje, admin vše
CREATE POLICY "transmissions_delete" ON transmissions
  FOR DELETE TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- =============================================================================
-- Hotovo! Jako další:
--   1. Vytvoř storage bucket "transmission-photos" (public, max 5MB, image/*)
--      → Dashboard → Storage → New bucket
--      (nebo spusť: node scripts/migrate.js — vytvoří bucket automaticky)
--   2. Vytvoř si účet v appce (/login → Sign up)
--   3. V Supabase dashboardu nastav svoje user metadata na:
--      {"role": "admin"}
--      → Authentication → Users → ... → Edit user → Raw user meta data
-- =============================================================================
