import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";
import path from "node:path";
import fs from "node:fs/promises";
import { env } from "../env.js";

interface StorageBackend {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  publicUrl(key: string): string;
}

class AzureBlobBackend implements StorageBackend {
  private svc: BlobServiceClient;
  private accountName: string;
  private accountKey?: string;
  private container = env.AZURE_STORAGE_CONTAINER;

  constructor(connStr: string) {
    this.svc = BlobServiceClient.fromConnectionString(connStr);
    const m = /AccountName=([^;]+);AccountKey=([^;]+)/.exec(connStr);
    this.accountName = m?.[1] ?? "";
    this.accountKey = m?.[2];
  }

  private blob(key: string) {
    return this.svc.getContainerClient(this.container).getBlockBlobClient(key);
  }

  async put(key: string, body: Buffer, contentType: string) {
    const containerClient = this.svc.getContainerClient(this.container);
    await containerClient.createIfNotExists();
    await this.blob(key).uploadData(body, { blobHTTPHeaders: { blobContentType: contentType } });
    return { url: this.publicUrl(key) };
  }

  publicUrl(key: string) {
    return `https://${this.accountName}.blob.core.windows.net/${this.container}/${encodeURIComponent(key)}`;
  }

  async signedUrl(key: string, ttlSeconds: number) {
    if (!this.accountKey) return this.publicUrl(key);
    const cred = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const expiresOn = new Date(Date.now() + ttlSeconds * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.container,
        blobName: key,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      cred,
    ).toString();
    return `${this.publicUrl(key)}?${sas}`;
  }
}

class LocalDiskBackend implements StorageBackend {
  private root = path.resolve(process.cwd(), "uploads");

  async put(key: string, body: Buffer) {
    const full = path.join(this.root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { url: this.publicUrl(key) };
  }

  publicUrl(key: string) {
    return `/uploads/${key.replace(/\\/g, "/")}`;
  }

  async signedUrl(key: string) {
    return this.publicUrl(key);
  }
}

let backend: StorageBackend;
if (env.AZURE_STORAGE_CONNECTION_STRING) {
  backend = new AzureBlobBackend(env.AZURE_STORAGE_CONNECTION_STRING);
  console.log("[storage] using Azure Blob Storage");
} else {
  backend = new LocalDiskBackend();
  console.log("[storage] using local disk fallback (./uploads)");
}

export const storage = backend;

export async function readFromUrl(urlOrKey: string): Promise<Buffer> {
  if (urlOrKey.startsWith("/uploads/")) {
    const key = urlOrKey.replace("/uploads/", "");
    return fs.readFile(path.resolve(process.cwd(), "uploads", key));
  }
  const res = await fetch(urlOrKey);
  if (!res.ok) throw new Error(`failed_to_fetch:${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
