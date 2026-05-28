import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { StorageConfigurationWithSecrets, StorageProviderClient, StorageUploadInput } from "@/server/storage/storage-provider";

export class LocalDevStorageProvider implements StorageProviderClient {
  private root: string;

  constructor(private config: StorageConfigurationWithSecrets) {
    if (env.NODE_ENV === "production") throw new Error("local_dev storage is not allowed in production.");
    this.root = path.join(process.cwd(), ".storage", config.bucketName);
  }

  async uploadFile(input: StorageUploadInput) {
    const fullPath = this.safePath(input.objectKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.body);
  }

  async getSignedReadUrl(input: { objectKey: string }) {
    return `/api/storage/local-dev/${encodeURIComponent(input.objectKey)}`;
  }

  async deleteFile(input: { objectKey: string }) {
    await fs.rm(this.safePath(input.objectKey), { force: true });
  }

  async copyFile(input: { sourceKey: string; destinationKey: string }) {
    const destination = this.safePath(input.destinationKey);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(this.safePath(input.sourceKey), destination);
  }

  async testConnection() {
    await fs.mkdir(this.root, { recursive: true });
    return { ok: true, message: "Local development storage directory is writable." };
  }

  async testUpload() {
    const objectKey = `storage-tests/${Date.now()}-test.txt`;
    await this.uploadFile({ objectKey, body: Buffer.from("nizamkitchen-storage-test"), mimeType: "text/plain" });
    return { ok: true, message: "Local test upload succeeded.", objectKey };
  }

  async testRead(input: { objectKey: string }) {
    await fs.readFile(this.safePath(input.objectKey));
    return { ok: true, message: "Local test read succeeded." };
  }

  async testDelete(input: { objectKey: string }) {
    await this.deleteFile(input);
    return { ok: true, message: "Local test delete succeeded." };
  }

  private safePath(objectKey: string) {
    const fullPath = path.join(this.root, objectKey);
    if (!fullPath.startsWith(this.root)) throw new Error("Unsafe storage path.");
    return fullPath;
  }
}
