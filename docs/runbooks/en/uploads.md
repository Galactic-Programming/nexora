# Runbook — Uploads (Supabase Storage signed URLs)

> 🇻🇳 Bản tiếng Việt: [`../vi/uploads.md`](../vi/uploads.md).

How the admin FE uploads images/files to Supabase Storage without proxying bytes through this Nest backend.

## Why signed URLs (and not multipart upload to Nest)

If the FE POST-ed a 5 MB image to `/admin/tours`, Nest would buffer the entire body before dispatching the handler. That blocks a worker for the duration of the upload, ties throughput to our Railway region, and bloats the backend deploy with `multer`/`busboy`.

The signed-URL flow flips it:

1. FE asks **us** for a short-lived signed URL.
2. FE PUTs the file **directly** to Supabase Storage's edge.
3. FE tells us "here's the path I uploaded to" via the relevant resource endpoint (e.g. `PATCH /admin/tours/:slug` with `heroImage = "tours/hero/1717..."`)

Nest never touches the bytes. Memory stays flat. Scaling is trivial.

## One-time bucket setup

1. Supabase Dashboard → Storage → **New bucket**
2. Name: `tourism-assets` (matches `SUPABASE_STORAGE_BUCKET` env)
3. **Public bucket: YES** — published tour images need to be readable without a token. Drafts that shouldn't leak are gated by the application, not by Storage ACLs.
4. File size limit: 10 MB (image hero shots rarely exceed this).
5. Allowed MIME types: `image/jpeg,image/png,image/webp,image/avif,application/pdf` (PDFs for vouchers in B3).

### Adding the policies via the Supabase Dashboard UI

The dashboard's policy editor does the same thing as raw SQL but auto-scopes the policy to the bucket, so you don't have to remember the `bucket_id` filter.

1. Storage → **Policies** tab (top of the Files section).
2. Find the **Buckets** section. Search `tourism-assets`. The card shows `PUBLIC` badge if the bucket was created with public toggle ON.
3. Click **New policy** on the `TOURISM-ASSETS` card (NOT the cards under "Schema" — those are for the underlying tables, too broad).
4. Choose **"For full customization"** (skip the templates — they add fields we don't need).
5. Fill in **policy 1 — signed upload writes:**
   - Policy name: `signed upload writes`
   - Allowed operation: **INSERT**
   - Target roles: `authenticated`
   - WITH CHECK expression: `bucket_id = 'tourism-assets'`
   - (Leave USING blank — INSERT only uses WITH CHECK)
6. Save, then **New policy** again for **policy 2 — public read:**
   - Policy name: `public read`
   - Allowed operation: **SELECT**
   - Target roles: `anon, authenticated` (equivalent to `public`)
   - USING expression: `bucket_id = 'tourism-assets'`
7. The card now lists 2 policies. Supabase auto-appends a short random suffix to the policy name (e.g. `signed upload writes 15igvad_0`) — harmless, the backend doesn't care about names.

### RLS policy template (raw SQL — equivalent to the UI walkthrough above)

Storage RLS for v1 is intentionally minimal — server-side enforcement via `@Roles(ADMIN)` is the gate; Storage policies are belt-and-braces. Open the bucket's **Policies** tab and add:

```sql
-- Allow signed-URL uploads. The service role bypasses RLS anyway, but
-- this lets authenticated users use signed URLs we issue them.
create policy "signed upload writes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tourism-assets');

-- Public read for everything in the bucket (matches "public bucket" toggle).
create policy "public read" on storage.objects
  for select to public
  using (bucket_id = 'tourism-assets');
```

Tighten per-folder later when we add a `vouchers/` subfolder that should only be readable by booking owners.

## End-to-end flow

### 1. FE asks backend for a signed URL

```http
POST /api/v1/admin/uploads/signed-url
Authorization: Bearer <admin JWT>
Content-Type: application/json

{
  "purpose": "TOUR_HERO",
  "filename": "hoi-an-hero.jpg",
  "contentType": "image/jpeg"
}
```

`purpose` enum:

| Value | Folder under bucket |
| --- | --- |
| `TOUR_HERO` | `tours/hero/` |
| `TOUR_GALLERY` | `tours/gallery/` |
| `DESTINATION_HERO` | `destinations/hero/` |
| `USER_AVATAR` | `users/avatars/` |

Response (200 OK):

```json
{
  "data": {
    "uploadUrl": "https://PROJECT_REF.supabase.co/storage/v1/object/upload/sign/tourism-assets/tours/hero/1717000000000-hoi-an-hero.jpg?token=...",
    "token": "eyJ...",
    "path": "tours/hero/1717000000000-hoi-an-hero.jpg",
    "bucket": "tourism-assets"
  },
  "error": null
}
```

### 2. FE uploads directly to Supabase

Two ways, equivalent:

**Supabase JS SDK (recommended):**

```ts
const { error } = await supabase.storage
  .from(bucket)
  .uploadToSignedUrl(path, token, file, {
    contentType: file.type,
  });
```

**Raw `fetch` PUT (no SDK):**

```ts
const res = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
  body: file,
});
```

### 3. FE persists the path on the parent resource

```http
PATCH /api/v1/admin/tours/hoi-an-walking-tour
Authorization: Bearer <admin JWT>

{ "heroImage": "tours/hero/1717000000000-hoi-an-hero.jpg" }
```

To resolve `heroImage` to a renderable URL, the FE prepends the public bucket URL:

```text
https://PROJECT_REF.supabase.co/storage/v1/object/public/tourism-assets/<path>
```

## Path derivation rules

The backend rewrites the FE's `filename` before signing:

- Strips any directory prefix (defence against `../../../etc/passwd`).
- Lowercases the stem.
- Collapses non-`[a-z0-9]` runs to `-`.
- Prefixes with `Date.now()` (Unix milliseconds) to guarantee uniqueness.
- Preserves the (lowercased) extension.

So `My Hero Shot.JPG` becomes `tours/hero/1717000000000-my-hero-shot.jpg`.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `400 VALIDATION_ERROR` on `signed-url` | DTO regex rejected `purpose`, `filename`, or `contentType` | Inspect the field-level error message — usually a slash or unusual char in `filename`. |
| `502 STORAGE_SIGN_FAILED` | Supabase Storage rejected the sign request | Check bucket exists, `SUPABASE_SERVICE_ROLE_KEY` is correct, project not paused. Backend logs the underlying error. |
| FE PUT returns 403 | Signed URL expired (2 h default) OR FE re-using a URL from a previous session | Mint a fresh URL each upload. |
| Image not visible after upload | Bucket isn't public OR `heroImage` path not persisted on the parent row | Verify bucket is public; check `Tour.heroImage` column. |

## Testing

- **Newman/Postman**: folder `Uploads (Admin)` mints two URLs (tour hero + destination hero). Status assertions allow `200` (signed OK) and `502` (bucket missing in test project) — both are valid CI outcomes since CI doesn't have a real bucket.
- **Local**: run `pnpm start:dev`, hit `POST /admin/uploads/signed-url` from Postman GUI, then `curl --upload-file ./test.jpg "$uploadUrl"` to verify the URL works end-to-end.
