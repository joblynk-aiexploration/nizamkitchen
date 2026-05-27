"use client";

import { useRef, useState, type ChangeEvent } from "react";
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
  cropOptions?: {
    aspectRatio: number;
    outputWidth: number;
    outputHeight: number;
    label: string;
    helperText: string;
  };
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
  cropOptions,
  className,
}: FileUploadFieldProps) {
  const [fileId, setFileId] = useState(defaultFileId ?? "");
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    event.target.value = "";

    if (previewKind === "image" && cropOptions) {
      if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
      setSelectedImage(file);
      setCropPosition({ x: 0, y: 0 });
      setCropZoom(1);
      setCropPreviewUrl(URL.createObjectURL(file));
      return;
    }

    await uploadFile(file, previewKind === "image" ? URL.createObjectURL(file) : null);
  }

  async function uploadFile(file: File, nextPreviewUrl: string | null) {
    setIsUploading(true);
    setError(null);
    if (nextPreviewUrl) setPreviewUrl(nextPreviewUrl);
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

  async function applyCrop() {
    if (!selectedImage || !cropOptions || !imageRef.current) return;
    setError(null);
    try {
      const cropped = await cropImageToFile({
        image: imageRef.current,
        originalFile: selectedImage,
        aspectRatio: cropOptions.aspectRatio,
        outputWidth: cropOptions.outputWidth,
        outputHeight: cropOptions.outputHeight,
        panX: cropPosition.x,
        panY: cropPosition.y,
        zoom: cropZoom,
      });
      const nextPreviewUrl = URL.createObjectURL(cropped);
      closeCropper();
      await uploadFile(cropped, nextPreviewUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to crop this image.");
    }
  }

  function closeCropper() {
    if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
    setCropPreviewUrl(null);
    setSelectedImage(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
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
      {cropPreviewUrl && cropOptions ? (
        <div className="mt-5 rounded-3xl border border-teal-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--color-ink)]">{cropOptions.label}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{cropOptions.helperText}</p>
            </div>
            <Button type="button" variant="ghost" onClick={closeCropper}>Cancel</Button>
          </div>
          <div
            className="relative mt-4 overflow-hidden rounded-3xl border border-white bg-slate-950 shadow-inner"
            style={{ aspectRatio: `${cropOptions.outputWidth} / ${cropOptions.outputHeight}` }}
          >
            {/* Local object URL preview before the form is saved. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={cropPreviewUrl}
              alt="Crop preview"
              className="absolute left-1/2 top-1/2 h-full w-full object-cover"
              style={{
                transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom})`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/80" />
            <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-white/60" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-[var(--color-ink)]">
              Zoom
              <input className="w-full accent-[var(--color-primary)]" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--color-ink)]">
              Move left/right
              <input className="w-full accent-[var(--color-primary)]" type="range" min="-80" max="80" step="1" value={cropPosition.x} onChange={(event) => setCropPosition((current) => ({ ...current, x: Number(event.target.value) }))} />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--color-ink)]">
              Move up/down
              <input className="w-full accent-[var(--color-primary)]" type="range" min="-80" max="80" step="1" value={cropPosition.y} onChange={(event) => setCropPosition((current) => ({ ...current, y: Number(event.target.value) }))} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={applyCrop} disabled={isUploading}>{isUploading ? "Uploading..." : "Crop and upload"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}>Reset crop</Button>
          </div>
        </div>
      ) : null}
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
  return (
    <ImageUploadField
      {...props}
      purpose="user_profile_photo"
      visibility="organization"
      cropOptions={{
        aspectRatio: 1,
        outputWidth: 800,
        outputHeight: 800,
        label: "Adjust profile photo",
        helperText: "Zoom, reposition, and crop your photo before it is uploaded.",
      }}
    />
  );
}

export function CoverPhotoUpload(props: Omit<FileUploadFieldProps, "purpose" | "visibility">) {
  return (
    <ImageUploadField
      {...props}
      purpose="user_cover_photo"
      visibility="organization"
      cropOptions={{
        aspectRatio: 3,
        outputWidth: 1800,
        outputHeight: 600,
        label: "Adjust cover photo",
        helperText: "Create a wide banner crop that looks polished across desktop and mobile.",
      }}
    />
  );
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

async function cropImageToFile({
  image,
  originalFile,
  aspectRatio,
  outputWidth,
  outputHeight,
  panX,
  panY,
  zoom,
}: {
  image: HTMLImageElement;
  originalFile: File;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  panX: number;
  panY: number;
  zoom: number;
}) {
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("Image is still loading. Please try again.");
  }

  const naturalAspect = image.naturalWidth / image.naturalHeight;
  const baseCropWidth = naturalAspect > aspectRatio ? image.naturalHeight * aspectRatio : image.naturalWidth;
  const baseCropHeight = naturalAspect > aspectRatio ? image.naturalHeight : image.naturalWidth / aspectRatio;
  const sourceWidth = Math.max(1, baseCropWidth / zoom);
  const sourceHeight = Math.max(1, baseCropHeight / zoom);
  const maxX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxY = Math.max(0, image.naturalHeight - sourceHeight);
  const sourceX = clamp(maxX / 2 - (panX / 80) * (maxX / 2), 0, maxX);
  const sourceY = clamp(maxY / 2 - (panY / 80) * (maxY / 2), 0, maxY);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Your browser could not crop this image.");
  const filename = originalFile.name.replace(/\.[^.]+$/, "") || "profile-photo";
  return new File([blob], `${filename}-cropped.jpg`, { type: "image/jpeg" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
