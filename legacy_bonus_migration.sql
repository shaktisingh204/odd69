-- =========================================================================
-- SAFE MIGRATION: LEGACY BONUS TO FIAT BONUS
-- =========================================================================

-- 1. Ensure we don't proceed with partial modifications if something fails mid-way
BEGIN;

-- 2. Move any legacy bonus funds into the new 'fiatBonus' wallet
UPDATE "User" 
SET "fiatBonus" = "fiatBonus" + "bonus" 
WHERE "bonus" > 0;

-- 3. Safely drop the old 'bonus' column as data is now secured
ALTER TABLE "User" 
DROP COLUMN "bonus";

-- 4. Commit the changes
COMMIT;
