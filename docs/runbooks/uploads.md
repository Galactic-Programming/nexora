# Runbook — Uploads (Cloudinary signed uploads)

How the admin FE uploads photos/clips to **Cloudinary** without proxying bytes
through this Nest backend. Supabase holds data only; all media lives in
Cloudinary and is tracked in the `media_assets` table.

## Why signed direct upload (not multipart to Nest)

If the FE POSTed a large file (especially video) to Nest, a worker would buffer
the whole body, tying throughput to our region and bloating the deploy. Instead:

1. FE asks **us** for a short-lived upload **signature**.
2. FE POSTs the file **directly** to Cloudinary's edge.
3. FE sends the resulting `publicId` (+ metadata) back on the resource via its
   `media[]` payload (e.g. `PATCH /admin/tours/:slug`).

Nest never touches the bytes. The `@Roles(ADMIN)` guard on the endpoint is the
gate for who may upload.

## One-time Cloudinary setup

1. Create a Cloudinary account → **Dashboard → Settings → API Keys**.
2. Put the credentials in env (see `.env.example`):
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` — public, sent to the FE.
   - `CLOUDINARY_API_SECRET` — **server-side only**, signs uploads.
   - `CLOUDINARY_UPLOAD_FOLDER` — root folder (default `tourism`).
3. (Recommended) In **Settings → Upload**, set an account-level max file size
   and allowed formats — the backend validates extension/contentType per
   purpose, but hard byte limits are enforced by Cloudinary.

## End-to-end flow

### 1. FE asks backend for a signature

```http
POST /api/v1/admin/uploads/signed-url
Authorization: Bearer <admin JWT>
Content-Type: application/json

{ "purpose": "TOUR_HERO", "filename": "hoi-an-hero.jpg", "contentType": "image/jpeg" }
```

`purpose` → folder + resource type:

| Value | Folder | Resource type |
| --- | --- | --- |
| `TOUR_HERO` | `tourism/tours/hero` | image |
| `TOUR_GALLERY` | `tourism/tours/gallery` | image |
| `TOUR_VIDEO` | `tourism/tours/video` | video |
| `DESTINATION_HERO` | `tourism/destinations/hero` | image |
| `DESTINATION_VIDEO` | `tourism/destinations/video` | video |
| `USER_AVATAR` | `tourism/users/avatars` | image |

Response (200 OK) — the **signed params envelope**:

```json
{
  "data": {
    "signature": "abc123...",
    "timestamp": 1717000000,
    "apiKey": "311813554951811",
    "cloudName": "dbkgeehow",
    "folder": "tourism/tours/hero",
    "publicId": "1717000000000-hoi-an-hero",
    "resourceType": "image",
    "uploadUrl": "https://api.cloudinary.com/v1_1/dbkgeehow/image/upload"
  },
  "error": null
}
```

The signature covers exactly `{ folder, public_id, timestamp }`. The FE must
send those three unchanged (plus `api_key`, `signature`, `file`), or Cloudinary
returns 401.

### 2. FE uploads directly to Cloudinary

```ts
const form = new FormData();
form.append('file', file);
form.append('api_key', apiKey);
form.append('timestamp', String(timestamp));
form.append('signature', signature);
form.append('folder', folder);
form.append('public_id', publicId);

const res = await fetch(uploadUrl, { method: 'POST', body: form });
const uploaded = await res.json(); // { public_id, width, height, format, duration, bytes, ... }
```

### 3. FE persists the media set on the parent resource

Send the **full** desired media set — `media[]` is replace-all per owner:

```http
PATCH /api/v1/admin/tours/hoi-an-walking-tour
Authorization: Bearer <admin JWT>

{
  "media": [
    { "publicId": "tourism/tours/hero/1717000000000-hoi-an-hero",
      "type": "IMAGE", "role": "hero", "width": 1920, "height": 1080 }
  ]
}
```

Delivery URLs are built by the backend from `publicId` at read time (images get
`f_auto,q_auto`; videos get a poster from the first frame), so transforms can
change without a data migration. The FE renders the `media[]` returned on reads.

## Format validation + public_id derivation

- **Format**: the extension must match the purpose's resource type (image vs
  video); a mismatched `contentType` is also rejected → `400 MEDIA_FORMAT_REJECTED`.
- **public_id**: directory prefix stripped (anti path-traversal), stem
  lowercased, non-`[a-z0-9]` collapsed to `-`, prefixed with `Date.now()`, and
  **no extension** (Cloudinary appends the format). `My Hero Shot.JPG` →
  `1717000000000-my-hero-shot`.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `400 VALIDATION_ERROR` | DTO rejected `purpose`/`filename`/`contentType` | Check the field-level message. |
| `400 MEDIA_FORMAT_REJECTED` | Extension/contentType doesn't match the purpose's resource type | Use a matching file (image purpose → image file, etc.). |
| Cloudinary POST returns 401 | FE altered a signed param, or clock skew on `timestamp` | Send `folder`/`public_id`/`timestamp` verbatim; mint a fresh signature. |
| Media not visible after save | `media[]` not persisted on the parent, or wrong `publicId` | Confirm the PATCH/POST included `media[]`; check the row in `media_assets`. |

## Testing

- **Newman/Postman**: folder `Uploads (Admin)` calls `signed-url` for a tour
  hero + a tour video and asserts the envelope fields (`signature`, `publicId`,
  `resourceType`, `uploadUrl`). No real file is uploaded in CI.
- **Local**: `pnpm --filter @tourism/api start:dev`, then POST `signed-url`
  from Postman and complete the upload with the `FormData` snippet above.
