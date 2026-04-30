INSERT INTO storage.buckets (id, name, public)
VALUES ('workflow-files', 'workflow-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Workflow files are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'workflow-files');

CREATE POLICY "Users upload own workflow files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'workflow-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own workflow files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'workflow-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own workflow files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'workflow-files' AND auth.uid()::text = (storage.foldername(name))[1]);