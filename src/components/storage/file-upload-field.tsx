"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadResult = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

type FileUploadFieldProps = {
  label: string;
  name: string;
  defaultFileId?: string | null;
  module: string;
  purpose: string;
  visibility?: "private" | "organization" | "public";
  entityType?: string;
  entityId?: string | null;
  accept?: string;
  hint?: string;
  previewKind?: "image" | "document" | "generic";
  className?: string;
};

export function FileUploadField({
  label,
  name,
  defaultFileId,
  module,
  purpose,
  visibility = "private",
  entityType,
  entityId,
  accept,
  hint,
  previewKind = "generic",
  className,
}: FileUploadFieldProps) {
  const [fileId, setFileId] = useState(defaultFileId ?? "");
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setPreviewUrl(previewKind === "image" ? URL.createObjectURL(file) : null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("module", module);
    formData.set("purpose", purpose);
    formData.set("visibility", visibility);
    if (entityType) formData.set("entityType", entityType);
    if (entityId) formData.set("entityId", entityId);

    const response = await fetch("/api/storage/upload", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    setIsUploading(false);

    if (!response.ok || !payload.file?.id) {
      setError(payload.error ?? "Upload failed.");
      return;
    }

    setUploaded(payload.file);
    setFileId(payload.file.id);
  }

  return (
    <div className={cn("rounded-2xl border border-[var(--color-border)] bg-white p-4", className)}>
      <input type="hidden" name={name} value={fileId} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">{label}</p>
          {hint ? <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p> : null}
          {fileId ? <p className="mt-1 text-xs text-emerald-700">Storage file attached: {fileId}</p> : null}
          {uploaded ? <p className="mt-1 text-xs text-[var(--color-muted)]">{uploaded.originalFilename} · {formatBytes(uploaded.sizeBytes)}</p> : null}
          {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
          {isUploading ? "Uploading..." : fileId ? "Replace file" : "Upload file"}
          <input type="file" accept={accept} onChange={onFileChange} className="sr-only" disabled={isUploading} />
        </label>
      </div>
      {previewUrl && previewKind === "image" ? (
        // Local object URL preview before the form is saved.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="mt-4 h-40 w-full rounded-2xl object-cover" />
      ) : null}
      {fileId ? (
        <Button type="button" variant="ghost" className="mt-3" onClick={() => { setFileId(""); setUploaded(null); setPreviewUrl(null); }}>
          Remove attached file
        </Button>
      ) : null}
    </div>
  );
}

export function ImageUploadField(props: Omit<FileUploadFieldProps, "accept" | "previewKind">) {
  return <FileUploadField {...props} accept="image/jpeg,image/png,image/webp" previewKind="image" />;
}

export function DocumentUploadField(props: Omit<FileUploadFieldProps, "accept" | "previewKind">) {
  return <FileUploadField {...props} accept="application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" previewKind="document" />;
}

export function ProfilePhotoUpload(props: Omit<FileUploadFieldProps, "purpose" | "visibility">) {
  return <ImageUploadField {...props} purpose="user_profile_photo" visibility="organization" />;
}

export function CoverPhotoUpload(props: Omit<FileUploadFieldProps, "purpose" | "visibility">) {
  return <ImageUploadField {...props} purpose="user_cover_photo" visibility="organization" />;
}

export function AvatarWithUpload(props: Omit<FileUploadFieldProps, "purpose" | "visibility">) {
  return <ProfilePhotoUpload {...props} />;
}

export function BusinessCoverUploader(props: Omit<FileUploadFieldProps, "purpose" | "visibility">) {
  return <ImageUploadField {...props} purpose="business_cover_photo" visibility="public" />;
}

export function FilePreviewCard({ fileId, label }: { fileId?: string | null; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-[var(--color-ink)]">{label}</p>
      <p className="mt-1 text-[var(--color-muted)]">{fileId ? `Attached file: ${fileId}` : "No file attached yet."}</p>
    </div>
  );
}

export function UploadedFileList({ files }: { files: Array<{ id: string; originalFilename?: string | null; purpose?: string | null }> }) {
  return (
    <div className="space-y-2">
      {files.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No uploaded files yet.</p> : null}
      {files.map((file) => (
        <div key={file.id} className="rounded-2xl border border-[var(--color-border)] p-3 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">{file.originalFilename ?? file.id}</p>
          <p className="text-xs text-[var(--color-muted)]">{file.purpose ?? "file"} · {file.id}</p>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
