# Supabase Setup Guide

This directory contains SQL scripts to set up the Supabase database, storage, and automated cleanup jobs.

## Setup Instructions

### 1. Create Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)

### 2. Create Database Table

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Open and run `01-create-table.sql`

This creates:
- `userTable` with all required fields
- Row Level Security (RLS) enabled
- Policy to ensure users can only access their own data

### 3. Create Storage Bucket

1. In the Supabase dashboard, navigate to **SQL Editor**
2. Open and run `02-create-storage-bucket.sql`

This creates:
- A public storage bucket named `userphotos`
- Policies allowing authenticated users to upload and access photos

### 4. Setup Auto-Delete for Images (Optional)

To automatically clean up old images and manage storage costs:

1. In the Supabase dashboard, navigate to **SQL Editor**
2. Open and run `03-setup-cron-cleanup.sql`

**Note:** This requires superuser privileges. If you get a permission error, you may need to:
- Use the Supabase CLI with superuser privileges
- Contact Supabase support to enable pg_cron extension
- Run this through the Supabase dashboard's SQL editor (if you have sufficient permissions)

This setup:
- Enables the `pg_cron` extension
- Creates a cleanup function that deletes images older than 30 days
- Schedules the cleanup job to run daily at 1:00 AM

### 5. Disable Email Confirmation (For Development)

To streamline the onboarding process during development:

1. Go to **Authentication** → **Providers** → **Email**
2. Uncheck the **"Confirm email"** option
3. Click **Save**

This allows users to sign up without email verification.

## Verify Setup

After completing the above steps:

1. Check the database:
   - Navigate to **Table Editor** in Supabase dashboard
   - Verify `userTable` exists with the correct schema

2. Check storage:
   - Navigate to **Storage** in Supabase dashboard
   - Verify `userphotos` bucket exists

3. Check cron jobs (if set up):
   - Run `SELECT * FROM cron.job;` in the SQL editor
   - Verify the cleanup job is listed

## Troubleshooting

### Permission Errors on pg_cron

If you encounter permission errors when running `03-setup-cron-cleanup.sql`:

- The pg_cron extension requires superuser privileges
- You can still use the storage and database without the cron job
- Consider using Supabase's built-in database functions or manual cleanup as an alternative

### Storage Not Public

If images aren't publicly accessible:

- Verify the `public` column is set to `true` in the storage.buckets table
- Check that RLS policies allow public reading of objects

### Table Access Issues

If users can't access their data:

- Verify RLS is enabled
- Check the policy uses `auth.uid() = "id"`
- Ensure users are authenticated before attempting access
