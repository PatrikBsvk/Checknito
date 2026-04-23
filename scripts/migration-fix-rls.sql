-- =============================================================================
-- FIX: RLS policies používaly SELECT FROM auth.users, což způsobovalo
-- "permission denied for table users". Přepisuju je tak, aby role čtení
-- probíhalo z JWT tokenu (auth.jwt() → user_metadata → role).
-- =============================================================================
-- Spusť v Supabase SQL Editoru:
--   https://supabase.com/dashboard/project/gwlwavglmppufvifbrdb/sql/new
-- =============================================================================

-- Helper function — čte roli z JWT
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- --- Operátoři ---------------------------------------------------------------
DROP POLICY IF EXISTS "operators_select" ON operators;
DROP POLICY IF EXISTS "operators_insert_admin" ON operators;
DROP POLICY IF EXISTS "operators_delete_admin" ON operators;

CREATE POLICY "operators_select" ON operators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "operators_insert_admin" ON operators
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "operators_delete_admin" ON operators
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- --- Transmise ---------------------------------------------------------------
DROP POLICY IF EXISTS "transmissions_select" ON transmissions;
DROP POLICY IF EXISTS "transmissions_insert" ON transmissions;
DROP POLICY IF EXISTS "transmissions_update" ON transmissions;
DROP POLICY IF EXISTS "transmissions_delete" ON transmissions;

CREATE POLICY "transmissions_select" ON transmissions
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "transmissions_insert" ON transmissions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "transmissions_update" ON transmissions
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "transmissions_delete" ON transmissions
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
