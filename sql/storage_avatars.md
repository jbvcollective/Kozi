# Supabase Storage: avatars bucket

The profile page uploads user photos to a bucket named **`avatars`**.

1. In Supabase: **Storage** → **New bucket**
2. Name: `avatars`
3. **Public bucket**: turn ON so profile images can be shown without signed URLs
4. (Optional) RLS: allow authenticated users to upload/update their own folder, e.g. path `{user_id}/*`

If the bucket doesn't exist, "Change photo" / sign-up photo upload will fail; the rest of sign-up still works and users can add a photo later.
