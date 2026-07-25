# Storage

NizamKitchen stores uploaded files in S3-compatible object storage in production, with local development fallback support for non-production environments.

## What Uses Storage

- User profile photos and cover photos
- Organization and business profile images
- Menu item photos
- Verification documents
- Support attachments
- Order attachments
- Admin Dropbox files

## Security Rules

- Storage credentials are server-side only.
- Private files use permission-checked signed URLs.
- Verification documents and other sensitive uploads are private by default.
- Admin Dropbox access is restricted to authorized admin roles.
- Uploaded production files must not be committed to Git.

## Common Environment Variables

```bash
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
ENCRYPTION_KEY=
```

## Admin Pages

- `/admin/storage`
- `/admin/storage/configuration`
- `/admin/storage/files`
- `/admin/storage/files/[id]`
- `/admin/storage/tests`
- `/admin/storage/maintenance`
- `/admin/dropbox`

## Operational Expectations

- Storage configuration changes should never reveal raw credentials after save.
- Test connection, upload, read, and delete should report safe results only.
- Missing storage configuration must show setup messaging instead of crashing upload-related pages.
- Broken or missing files should render placeholders instead of broken UI.

## What Is Still Placeholder

- Some maintenance workflows around orphaned objects remain admin-assisted rather than fully automated.
- Local development may use MinIO-style object storage instead of real AWS S3.

## Launch Checklist

- Configure and test the production bucket.
- Verify signed URL access rules for private documents.
- Confirm admin Dropbox permissions by role.
- Confirm uploads are not written to local production disk.
