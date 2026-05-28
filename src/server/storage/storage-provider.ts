import type { StorageConfiguration, StorageFile } from "@prisma/client";

export type StorageUploadInput = {
  objectKey: string;
  body: Buffer;
  mimeType: string;
};

export type StorageProviderClient = {
  uploadFile(input: StorageUploadInput): Promise<void>;
  getSignedReadUrl(input: { objectKey: string; expiresInSeconds: number; file?: StorageFile }): Promise<string>;
  getSignedUploadUrl?(input: { objectKey: string; mimeType: string; expiresInSeconds: number }): Promise<string>;
  deleteFile(input: { objectKey: string }): Promise<void>;
  copyFile(input: { sourceKey: string; destinationKey: string }): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  testUpload(): Promise<{ ok: boolean; message: string; objectKey?: string }>;
  testRead(input: { objectKey: string }): Promise<{ ok: boolean; message: string }>;
  testDelete(input: { objectKey: string }): Promise<{ ok: boolean; message: string }>;
};

export type StorageConfigurationWithSecrets = StorageConfiguration & {
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  sessionToken?: string | null;
};
