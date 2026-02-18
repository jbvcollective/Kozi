# Supabase Storage: avatars and agent-assets (bulletproof setup)

**Do not run this .md file in the SQL Editor.** It is documentation only.

**To fix "new row violates row-level security policy" on upload:** run **`sql/storage_agent_assets_rls.sql`** in the Supabase **SQL Editor** once. That file adds the correct RLS policies on `storage.objects` for the `agent-assets` bucket so uploads (including during signup) and reads work. Alternatively you can add policies by hand in **Storage** → **agent-assets** → **Policies** (see below).

---

## Bucket name must match exactly
- **Agents (brokers):** bucket name must be **`agent-assets`** (all lowercase, hyphen).  
  Do **not** use "Agent Profile Picture" or other names — the app looks for `agent-assets`.
- **Regular users:** bucket name must be **`avatars`**.

---

## agent-assets (brokers/agents) — secure setup

1. In Supabase: **Storage** → **New bucket** (or edit existing).
2. **Bucket name:** `agent-assets` (cannot be changed after creation).
3. **Public bucket**
   - **ON** = app works as-is; image URLs are “unlisted” (long, hard to guess). No extra code.
   - **OFF** = private bucket; you must use **signed URLs** (see below). More secure, no public link.
4. **Restrict file size:** turn **ON** → set limit (e.g. **5** MB). Stops huge uploads and abuse.
5. **Restrict MIME types:** turn **ON** → allow only:
   - `image/png`
   - `image/jpeg`
   - `image/gif`
   - `image/webp`  
   Stops non-image uploads (e.g. executables).
6. After creation: in **Storage** → **Policies** for `agent-assets`, add a policy so **only authenticated users** can upload, and only to their own folder:  
   - Path: `{user_id}/*` (replace `user_id` with the auth user’s ID in the policy expression).

Result: only real images, size-capped, and only the owner can upload to their path. URLs are not guessable if the bucket is public.

---

## avatars (regular users)

1. **Bucket name:** `avatars`
2. Same idea: **Restrict file size** ON (e.g. 5 MB), **Restrict MIME types** ON (images only).
3. **Public bucket** ON so profile photos display, or OFF if you add signed-URL support for avatars too.

---

## Checklist in “Create file bucket” modal

| Field | Value |
|-------|--------|
| **Bucket name** | `agent-assets` (exactly — not “Agent Profile Picture”) |
| **Public bucket** | ON (so images load in the app; URLs are long and unlisted) |
| **Restrict file size** | ON → e.g. **5** MB |
| **Restrict MIME types** | ON → add: `image/png`, `image/jpeg`, `image/gif`, `image/webp` |

Then click **Create**. After creation, add Storage policies (see below).

If a bucket doesn’t exist or the name is wrong, uploads will fail with “Bucket not found”. Use exactly `agent-assets` (and `avatars` for user avatars).

---

## How to add a policy to agent-assets

In Supabase go to **Storage** → click **agent-assets** → **Policies** → **New policy** (or “Adding new policy to agent-assets”). Create **two** policies:

### Policy 1: Allow uploads (including during signup, before authenticated)

Users can add a profile photo during sign-up before they are authenticated. This policy allows both **anon** and **authenticated** to INSERT, but only into paths whose first folder is a UUID (your app uses the new user’s id from sign-up for that path).

| Field | Value |
|-------|--------|
| **Policy name** | `Upload to own or UUID folder` |
| **Allowed operation** | Check **INSERT** only |
| **Target roles** | Leave default so **anon** and **authenticated** both get this policy (or select both if your UI requires it). |
| **Policy definition** | Paste this (one line): |

```sql
bucket_id = 'agent-assets' AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
```

- **Authenticated:** your app uploads to `{auth.uid()}/profile-xxx.png`, which matches the UUID pattern.
- **Anon (signup):** after `signUp()` the app has the new user’s id and uploads to `{new_user_id}/profile-xxx.png`, which also matches. Anon cannot upload to arbitrary paths (only UUID first segment).

---

### Policy 2: Allow reading objects (so images can be shown)

| Field | Value |
|-------|--------|
| **Policy name** | `Anyone can read agent-assets` |
| **Allowed operation** | Check **SELECT** only |
| **Target roles** | Leave default (all roles) so image URLs work for everyone |
| **Policy definition** | Paste this (one line): |

```sql
bucket_id = 'agent-assets'
```

This allows read/download so that `getPublicUrl` image links work. Objects are still “unlisted” (only someone with the full URL can load them).

---

Click **Review** then **Save** for each policy. After both are added, uploads will work for sign-up (anon) and for logged-in agents, and images will display in the app.
