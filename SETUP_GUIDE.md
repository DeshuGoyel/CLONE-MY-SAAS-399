# Setup Guide for cvphoto.app

This guide will walk you through setting up the cvphoto.app project locally.

## Pre-requirements

- **Node.js v20.14.0 or above** installed on your system
- A **GitHub account** with:
  - Authentication set up via CLI or GitHub Desktop App
  - The email address we sent the invitation to must be connected to your GitHub account

## 1. Start a Local Server

In your terminal, run the following commands one-by-one:

```bash
git clone https://github.com/johnnetr2/cvphoto.app.git [YOUR_APP_NAME]
cd [YOUR_APP_NAME]
npm install
git remote remove origin
```

## 2. Rename Environment File

```bash
mv .env.example .env.local
```

## 3. Environment Variables

Go to the [Supabase dashboard](https://supabase.com/dashboard), create a new project and paste your 3 Supabase environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note:** You can find these values in your Supabase project settings under **API**.

## 4. Create Database Table

Go to the Supabase dashboard, open the SQL editor, and run the SQL script at `supabase/01-create-table.sql` to create the userTable:

```sql
CREATE TABLE public."userTable" (
  "created_at" TIMESTAMP WITH TIME ZONE,
  "email" TEXT,
  "id" UUID PRIMARY KEY,
  "paymentStatus" TEXT,
  "amount" NUMERIC,
  "planType" TEXT,
  "paid_at" TIMESTAMP WITH TIME ZONE,
  "name" TEXT,
  "height" TEXT,
  "gender" TEXT,
  "eyeColor" TEXT,
  "ethnicity" TEXT,
  "bodyType" TEXT,
  "age" TEXT,
  "styles" JSONB,
  "userPhotos" JSONB,
  "submissionDate" TIMESTAMP WITH TIME ZONE,
  "workStatus" TEXT,
  "downloadHistory" JSONB,
  "apiStatus" JSONB,
  "tuneStatus" TEXT,
  "promptsResult" JSONB
);

ALTER TABLE public."userTable" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "basic"
ON public."userTable"
TO authenticated
USING (auth.uid() = "id");
```

After executing the SQL, your database is ready to use.

## 5. Disable Email Confirmation

Go to the Supabase dashboard Authentication settings and disable email confirmation:

1. Navigate to **Authentication** → **Providers** → **Email**
2. Uncheck **"Confirm email"** option
3. Click **"Save"** to apply changes

This allows users to sign up without email verification, streamlining the onboarding process.

## 6. Create Storage Bucket

Go to the Supabase SQL editor and run the SQL script at `supabase/02-create-storage-bucket.sql` to create a storage bucket for user photos:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('userphotos', 'userphotos', true);

CREATE POLICY "Allow authenticated user access"
ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'userphotos');
```

This creates a public storage bucket named `"userphotos"` and sets up the necessary permissions for authenticated users to access it.

## 7. Setup Auto-Delete for Images

Configure automatic deletion of images after 30 days to optimize storage and reduce costs. Run the SQL script at `supabase/03-setup-cron-cleanup.sql` in the Supabase SQL editor:

```sql
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_images()
RETURNS void AS $$
BEGIN
  -- Delete from storage and update table
  DELETE FROM storage.objects
  WHERE bucket_id = 'userphotos'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule job to run daily at 1 AM
SELECT cron.schedule('0 1 * * *', 'SELECT cleanup_old_images()');
```

**Note:** The pg_cron extension requires superuser privileges. If you encounter permission errors, you may need to:
- Use Supabase CLI with superuser privileges
- Contact Supabase support
- Skip this step and clean up manually (images will still work, just won't auto-delete)

This creates an automated task that runs daily at 1 AM to remove images older than 30 days from the storage bucket, helping to manage storage costs and maintenance automatically.

## Ready to Run Locally

After completing the above steps, run:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) to see your local site.

## Project Structure

```
📁 /app                    → Pages (1 folder + page.tsx = 1 page)
📁 /src/action             → Server calls (1 file = 1 server action e.g. sendEmail.ts or verifyPayment.ts etc.)
📁 /components             → UI components and landing page components
📁 /src/api                → API & Webhooks (1 file = 1 webhook or API, e.g. createTune.ts and createPrompt.ts)
📁 /supabase               → SQL scripts for database setup
```

## Environment Variables

Configure your environment variables in `.env.local`:

```env
# Supabase AUTH & DB
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Keys
STRIPE_TEST_SECRET_KEY=your_stripe_test_key
STRIPE_SECRET_KEY=your_stripe_live_key

# Sendgrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
NOREPLY_EMAIL=noreply@yourdomain.com

# Environment
ENVIRONMENT=DEVELOPMENT

# Supabase S3 (Optional)
SUPABASE_S3_ACCESS_KEY_ID=your_s3_access_key_id
SUPABASE_S3_SECRET_ACCESS_KEY=your_s3_secret_access_key

# Astria AI Integration
ASTRIA_API_KEY=your_astria_api_key

# Webhook Security
APP_WEBHOOK_SECRET=your_webhook_secret
```

Make sure to never commit your `.env.local` file to version control. Add it to your `.gitignore` file if it's not already there.

⚠️ **Important:** Configure variables in both local (`.env.local`) and production (Vercel Dashboard → Settings → Environment Variables). Many errors come from incorrect environment variable configuration.

## Terminal Shortcuts Used in Video

The command `qp` shown in the video stands for "quick push" and combines three Git commands:

```bash
git add .
git commit -m "any text"
git push
```

You can create this alias by adding this to your `~/.bashrc` or `~/.zshrc`:

```bash
alias qp='git add . && git commit -m "update" && git push'
```

The command `rundev` is an alias for:

```bash
npm run dev
```

You can create this alias by adding this to your shell config:

```bash
alias rundev='npm run dev'
```

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and keys are correct in `.env.local`
- Check that your Supabase project is not paused
- Ensure you've created the `userTable` by running the SQL scripts

### Storage Upload Errors
- Verify the `userphotos` bucket exists in Supabase Storage
- Check that RLS policies are properly configured
- Ensure users are authenticated before attempting uploads

### Cron Job Not Working
- The pg_cron extension requires superuser privileges
- Check if the extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Verify the job is scheduled: `SELECT * FROM cron.job;`
- If you don't have superuser access, you can manually delete old images or contact Supabase support

For more detailed information, see the [supabase/README.md](supabase/README.md) file.
