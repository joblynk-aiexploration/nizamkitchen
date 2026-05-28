import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfigurationWithSecrets, StorageProviderClient, StorageUploadInput } from "@/server/storage/storage-provider";

export class S3StorageProvider implements StorageProviderClient {
  private client: S3Client;

  constructor(private config: StorageConfigurationWithSecrets) {
    if (!config.accessKeyId || !config.secretAccessKey) throw new Error("S3 credentials are not configured.");
    this.client = new S3Client({
      region: config.region ?? "us-east-1",
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken ?? undefined,
      },
    });
  }

  async uploadFile(input: StorageUploadInput) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.mimeType,
    }));
  }

  async getSignedReadUrl(input: { objectKey: string; expiresInSeconds: number }) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucketName, Key: input.objectKey }), { expiresIn: input.expiresInSeconds });
  }

  async getSignedUploadUrl(input: { objectKey: string; mimeType: string; expiresInSeconds: number }) {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.config.bucketName, Key: input.objectKey, ContentType: input.mimeType }), { expiresIn: input.expiresInSeconds });
  }

  async deleteFile(input: { objectKey: string }) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucketName, Key: input.objectKey }));
  }

  async copyFile(input: { sourceKey: string; destinationKey: string }) {
    await this.client.send(new CopyObjectCommand({
      Bucket: this.config.bucketName,
      CopySource: `${this.config.bucketName}/${input.sourceKey}`,
      Key: input.destinationKey,
    }));
  }

  async testConnection() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucketName }));
    return { ok: true, message: "S3 bucket connection succeeded." };
  }

  async testUpload() {
    const objectKey = `storage-tests/${Date.now()}-test.txt`;
    await this.uploadFile({ objectKey, body: Buffer.from("nizamkitchen-storage-test"), mimeType: "text/plain" });
    return { ok: true, message: "S3 test upload succeeded.", objectKey };
  }

  async testRead(input: { objectKey: string }) {
    await this.client.send(new GetObjectCommand({ Bucket: this.config.bucketName, Key: input.objectKey }));
    return { ok: true, message: "S3 test read succeeded." };
  }

  async testDelete(input: { objectKey: string }) {
    await this.deleteFile(input);
    return { ok: true, message: "S3 test delete succeeded." };
  }
}
