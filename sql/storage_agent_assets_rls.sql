-- Storage RLS for agent-assets bucket (fixes "new row violates row-level security policy" on upload).
-- Run this once in Supabase SQL Editor. Creates policies on storage.objects so uploads and reads work.

-- 1) Allow authenticated users to INSERT (upload) only into their own folder: {auth.uid()}/...
DROP POLICY IF EXISTS "agent-assets INSERT authenticated" ON storage.objects;
CREATE POLICY "agent-assets INSERT authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent-assets'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- 2) Allow anon to INSERT during signup: only when first path segment is a UUID (app uses new user id).
DROP POLICY IF EXISTS "agent-assets INSERT anon uuid path" ON storage.objects;
CREATE POLICY "agent-assets INSERT anon uuid path"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'agent-assets'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- 3) Allow anyone to SELECT (read) so image URLs work.
DROP POLICY IF EXISTS "agent-assets SELECT" ON storage.objects;
CREATE POLICY "agent-assets SELECT"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-assets');

-- Optional: allow authenticated to UPDATE/DELETE their own files (for "change photo" overwrite).
DROP POLICY IF EXISTS "agent-assets UPDATE authenticated" ON storage.objects;
CREATE POLICY "agent-assets UPDATE authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'agent-assets' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'agent-assets' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "agent-assets DELETE authenticated" ON storage.objects;
CREATE POLICY "agent-assets DELETE authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agent-assets' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
