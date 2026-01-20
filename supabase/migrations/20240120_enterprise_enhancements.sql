-- =====================================================
-- CVPHOTO Enterprise Enhancements Migration
-- Created: 2024-01-20
-- Description: Adds indexes, new fields, and optimizations
--              for enterprise-grade performance and features
-- =====================================================

-- Add new fields for enhanced features
-- =====================================================

-- Regeneration tracking
ALTER TABLE "userTable" 
ADD COLUMN IF NOT EXISTS "regenerationCount" INTEGER DEFAULT 0;

-- Referral program
ALTER TABLE "userTable" 
ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(8),
ADD COLUMN IF NOT EXISTS "referrals" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "referralRewards" DECIMAL(10,2) DEFAULT 0;

-- Custom prompts storage
ALTER TABLE "userTable"
ADD COLUMN IF NOT EXISTS "customPrompts" JSONB DEFAULT '[]'::jsonb;

-- Tune status tracking
ALTER TABLE "userTable"
ADD COLUMN IF NOT EXISTS "tuneStatus" VARCHAR(50) DEFAULT 'pending';

-- Performance indexes
-- =====================================================

-- Primary identification index (if not exists)
CREATE INDEX IF NOT EXISTS idx_userTable_id ON "userTable"(id);

-- Email lookup (for authentication and referral matching)
CREATE INDEX IF NOT EXISTS idx_userTable_email ON "userTable"(email);

-- Payment status (frequent queries for paid users)
CREATE INDEX IF NOT EXISTS idx_userTable_paymentStatus ON "userTable"("paymentStatus");

-- Work status (dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_userTable_workStatus ON "userTable"("workStatus");

-- Created at (analytics and reporting)
CREATE INDEX IF NOT EXISTS idx_userTable_created_at ON "userTable"(created_at);

-- Referral code lookup (for applying referral codes)
CREATE INDEX IF NOT EXISTS idx_userTable_referralCode ON "userTable"("referralCode");

-- Composite indexes for common query patterns
-- =====================================================

-- Paid users with completed work (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_userTable_status_combo 
ON "userTable"("paymentStatus", "workStatus");

-- Plan type with payment status (analytics)
CREATE INDEX IF NOT EXISTS idx_userTable_plan_payment 
ON "userTable"("planType", "paymentStatus");

-- Tune status for monitoring
CREATE INDEX IF NOT EXISTS idx_userTable_tuneStatus 
ON "userTable"("tuneStatus");

-- Add comments for documentation
-- =====================================================

COMMENT ON COLUMN "userTable"."regenerationCount" IS 'Number of times user has regenerated images';
COMMENT ON COLUMN "userTable"."referralCode" IS 'Unique 8-character referral code for this user';
COMMENT ON COLUMN "userTable"."referrals" IS 'Array of users who signed up using this user''s referral code';
COMMENT ON COLUMN "userTable"."referralRewards" IS 'Total dollar amount earned from referrals';
COMMENT ON COLUMN "userTable"."customPrompts" IS 'Custom prompts submitted by user for image generation';
COMMENT ON COLUMN "userTable"."tuneStatus" IS 'Current status of model tuning: pending, processing, completed, failed';

-- Update RLS policies for new fields
-- =====================================================

-- Users can read their own referral data
CREATE POLICY IF NOT EXISTS "Users can read own referral data" 
ON "userTable"
FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own regeneration count (tracked by API)
-- This is handled via service role in API, no additional policy needed

-- Create function to automatically generate referral code
-- =====================================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."referralCode" IS NULL THEN
    NEW."referralCode" := upper(substring(md5(random()::text || NEW.id::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate referral code on user creation
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON "userTable";
CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON "userTable"
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- Create indexes on JSONB fields for better performance
-- =====================================================

-- Index on promptsResult for analytics queries
CREATE INDEX IF NOT EXISTS idx_userTable_promptsResult_gin 
ON "userTable" USING GIN ("promptsResult");

-- Index on referrals for lookup performance
CREATE INDEX IF NOT EXISTS idx_userTable_referrals_gin 
ON "userTable" USING GIN ("referrals");

-- Index on customPrompts
CREATE INDEX IF NOT EXISTS idx_userTable_customPrompts_gin 
ON "userTable" USING GIN ("customPrompts");

-- Performance optimization: Analyze tables
-- =====================================================

ANALYZE "userTable";

-- Create view for analytics (optional - for reporting)
-- =====================================================

CREATE OR REPLACE VIEW user_analytics AS
SELECT 
  id,
  email,
  "planType",
  "paymentStatus",
  "workStatus",
  created_at,
  jsonb_array_length(COALESCE("promptsResult", '[]'::jsonb)) as prompt_count,
  jsonb_array_length(COALESCE("downloadHistory", '[]'::jsonb)) as download_count,
  "regenerationCount",
  jsonb_array_length(COALESCE("referrals", '[]'::jsonb)) as referral_count,
  "referralRewards"
FROM "userTable";

-- Grant access to authenticated users for their own data
-- =====================================================

GRANT SELECT ON user_analytics TO authenticated;

-- Migration complete
-- =====================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: regenerationCount, referralCode, referrals, referralRewards, customPrompts, tuneStatus';
  RAISE NOTICE 'Created indexes: id, email, paymentStatus, workStatus, created_at, referralCode, status_combo, plan_payment, tuneStatus';
  RAISE NOTICE 'Created GIN indexes on JSONB fields';
  RAISE NOTICE 'Created user_analytics view';
  RAISE NOTICE 'Auto-generation trigger for referral codes enabled';
END $$;
