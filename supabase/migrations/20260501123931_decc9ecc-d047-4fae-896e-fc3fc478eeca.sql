-- Make workflow-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'workflow-files';

-- Drop any existing public read policy on workflow-files
DROP POLICY IF EXISTS "Public read workflow files" ON storage.objects;
DROP POLICY IF EXISTS "Workflow files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can read workflow files" ON storage.objects;

-- Owners can read their own workflow files (needed to create signed URLs)
CREATE POLICY "Users read own workflow files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workflow-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
