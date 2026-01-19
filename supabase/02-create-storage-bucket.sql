-- Create a public storage bucket for user photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('userphotos', 'userphotos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to access the bucket
CREATE POLICY "Allow authenticated user access"
ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'userphotos')
WITH CHECK (bucket_id = 'userphotos');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
