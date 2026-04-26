-- Migrace: sloupec "model" pro transmise (T-590 / T-450 / T-590 RS)
-- Pusť v Supabase SQL editoru.

-- 1) Nový sloupec (zatím nullable — existující řádky ještě nemají hodnotu)
ALTER TABLE transmissions
  ADD COLUMN IF NOT EXISTS model TEXT;

-- 2) CHECK constraint: povolené pouze tyto hodnoty (nebo NULL pro stará data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transmissions_model_check'
  ) THEN
    ALTER TABLE transmissions
      ADD CONSTRAINT transmissions_model_check
      CHECK (model IS NULL OR model IN ('T-590', 'T-450', 'T-590 RS'));
  END IF;
END $$;

-- 3) Index (bude se podle modelu filtrovat / počítat statistika)
CREATE INDEX IF NOT EXISTS idx_transmissions_model
  ON transmissions(model);
