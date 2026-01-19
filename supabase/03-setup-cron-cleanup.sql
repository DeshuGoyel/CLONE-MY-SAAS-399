-- Enable pg_cron extension (requires superuser privileges)
-- Note: This must be run as a superuser in Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function to delete old images
CREATE OR REPLACE FUNCTION cleanup_old_images()
RETURNS void AS $$
BEGIN
  -- Delete images from storage that are older than 30 days
  DELETE FROM storage.objects
  WHERE bucket_id = 'userphotos'
  AND created_at < NOW() - INTERVAL '30 days';
  
  -- Optional: Log the cleanup (commented out by default)
  -- RAISE NOTICE 'Deleted % old images from storage', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

-- Schedule job to run daily at 1 AM
-- Format: cron.schedule(schedule, command)
SELECT cron.schedule(
  '0 1 * * *',  -- Daily at 1:00 AM
  'SELECT cleanup_old_images()'
);

-- Verify the job was scheduled
SELECT * FROM cron.job;
