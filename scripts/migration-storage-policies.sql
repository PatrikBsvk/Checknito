-- Migrace: RLS policies pro storage bucket "transmission-photos"
-- Pusť v Supabase SQL editoru.
--
-- Problém: při uložení transmise selhává upload fotky s chybou
--   "new row violates row-level security policy"
-- Příčina: bucket má RLS on, ale žádné policy pro INSERT/SELECT/DELETE.
-- Řešení: policy pro authenticated users.

-- Helper: na objekty v našem bucketu
-- (Supabase ukládá storage objekty do tabulky storage.objects, sloupec bucket_id).

-- 1) SELECT — kdokoli (anonym i auth) může stáhnout fotku.
--    Bucket je public, takže URL fotky musí jít otevřít i bez přihlášení.
DROP POLICY IF EXISTS "transmission_photos_select" ON storage.objects;
CREATE POLICY "transmission_photos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'transmission-photos');

-- 2) INSERT — pouze přihlášení uživatelé mohou nahrávat
DROP POLICY IF EXISTS "transmission_photos_insert" ON storage.objects;
CREATE POLICY "transmission_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'transmission-photos');

-- 3) DELETE — přihlášení uživatelé mohou mazat (pro delete transmise)
DROP POLICY IF EXISTS "transmission_photos_delete" ON storage.objects;
CREATE POLICY "transmission_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'transmission-photos');

-- 4) UPDATE — obvykle se nepoužívá, ale pro kompletní sadu:
DROP POLICY IF EXISTS "transmission_photos_update" ON storage.objects;
CREATE POLICY "transmission_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'transmission-photos')
  WITH CHECK (bucket_id = 'transmission-photos');

-- Ověření: seznam policies na bucketu
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'transmission_photos%';
