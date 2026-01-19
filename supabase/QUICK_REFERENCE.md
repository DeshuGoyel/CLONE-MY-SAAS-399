# Quick Reference: Supabase SQL Scripts

This document provides a quick reference for running the Supabase SQL scripts in order.

## Script Execution Order

Run these scripts in the Supabase SQL Editor in the following order:

### 1. Create Database Table

**File:** `supabase/01-create-table.sql`

**What it does:**
- Creates the `userTable` with all required columns
- Enables Row Level Security (RLS)
- Creates a policy to ensure users can only access their own data

**Verification:**
```sql
SELECT * FROM public."userTable" LIMIT 0;
```

---

### 2. Create Storage Bucket

**File:** `supabase/02-create-storage-bucket.sql`

**What it does:**
- Creates a public storage bucket named `userphotos`
- Sets up RLS policies for authenticated users
- Grants necessary permissions

**Verification:**
```sql
SELECT * FROM storage.buckets WHERE id = 'userphotos';
```

---

### 3. Setup Auto-Delete Cron Job

**File:** `supabase/03-setup-cron-cleanup.sql`

**What it does:**
- Enables the `pg_cron` extension
- Creates a function to delete images older than 30 days
- Schedules the cleanup to run daily at 1:00 AM

**Note:** This requires superuser privileges. If you encounter permission errors, you can skip this step.

**Verification:**
```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check scheduled jobs
SELECT * FROM cron.job;
```

---

## Manual Verification After Setup

After running all scripts, verify your setup:

### Check Database Table
```sql
-- Table structure
\d public."userTable"

-- RLS policies
SELECT * FROM pg_policies WHERE tablename = 'userTable';
```

### Check Storage
```sql
-- Storage buckets
SELECT * FROM storage.buckets;

-- Storage policies
SELECT * FROM pg_policies WHERE schemaname = 'storage';
```

### Check Cron Job (if enabled)
```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'cleanup_old_images';
```

---

## Common Issues

### "permission denied for extension pg_cron"

**Solution:** The pg_cron extension requires superuser privileges. You can:
1. Skip this step (storage will still work, just without auto-cleanup)
2. Contact Supabase support to enable it
3. Use Supabase CLI with superuser access
4. Set up manual cleanup instead

### "relation "userTable" already exists"

**Solution:** If the table already exists, you can either:
1. Skip the table creation script
2. Drop and recreate (WARNING: this will delete all data):
   ```sql
   DROP TABLE IF EXISTS public."userTable" CASCADE;
   ```

### "bucket already exists"

**Solution:** The script uses `ON CONFLICT DO NOTHING`, so you can safely re-run it. If you need to recreate:
```sql
DELETE FROM storage.objects WHERE bucket_id = 'userphotos';
DELETE FROM storage.buckets WHERE id = 'userphotos';
```

---

## Additional Commands

### Manually Trigger Cleanup
If you want to manually run the cleanup function:

```sql
SELECT cleanup_old_images();
```

### Change Cleanup Interval
To change the cleanup interval (e.g., from 30 days to 7 days):

1. Drop and recreate the function:
```sql
DROP FUNCTION IF EXISTS cleanup_old_images();

CREATE OR REPLACE FUNCTION cleanup_old_images()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'userphotos'
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

2. The scheduled job will automatically use the new function.

### Remove Scheduled Job
To remove the cron job:

```sql
SELECT cron.unschedule('0 1 * * *');
```

### Drop Everything (Start Over)
⚠️ **WARNING:** This will delete all data!

```sql
-- Remove cron job
SELECT cron.unschedule('0 1 * * *');

-- Drop function
DROP FUNCTION IF EXISTS cleanup_old_images();

-- Remove extension
DROP EXTENSION IF EXISTS pg_cron CASCADE;

-- Delete storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'userphotos';
DELETE FROM storage.buckets WHERE id = 'userphotos';

-- Drop table
DROP TABLE IF EXISTS public."userTable" CASCADE;
```

---

For detailed setup instructions, see [SETUP_GUIDE.md](../SETUP_GUIDE.md) and [README.md](README.md).
