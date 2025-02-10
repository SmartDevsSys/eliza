-- Enable storage
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'agent-logos',
    'agent-logos',
    true,
    5242880, -- 5MB file size limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Ensure bucket exists before creating policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'agent-logos') THEN
        RAISE EXCEPTION 'Bucket agent-logos does not exist';
    END IF;
END $$;

-- Drop existing bucket-specific policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads on agent-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public view on agent-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates on agent-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes on agent-logos" ON storage.objects;

-- Create bucket-specific policies
CREATE POLICY "Allow authenticated uploads on agent-logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'agent-logos'
    AND (storage.foldername(name))[1] != 'private'
);

-- Allow public to view logos
CREATE POLICY "Allow public view on agent-logos"
ON storage.objects FOR SELECT
TO public
USING (
    bucket_id = 'agent-logos'
    AND (storage.foldername(name))[1] != 'private'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated updates on agent-logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'agent-logos'
    AND (storage.foldername(name))[1] != 'private'
)
WITH CHECK (
    bucket_id = 'agent-logos'
    AND (storage.foldername(name))[1] != 'private'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Allow authenticated deletes on agent-logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'agent-logos'
    AND (storage.foldername(name))[1] != 'private'
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
