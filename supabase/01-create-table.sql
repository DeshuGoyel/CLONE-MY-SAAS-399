-- Create the userTable with all required fields
CREATE TABLE public."userTable" (
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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

-- Enable Row Level Security
ALTER TABLE public."userTable" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own data
CREATE POLICY "basic"
ON public."userTable"
TO authenticated
USING (auth.uid() = "id");
