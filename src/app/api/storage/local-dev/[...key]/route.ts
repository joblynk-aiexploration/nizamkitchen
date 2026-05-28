import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { StorageProvider } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { canAccessStorageFile } from "@/server/storage/storage-permissions";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { key } = await params;
  const objectKey = decodeURIComponent(key.join("/"));
  const file = await prisma.storageFile.findFirst({
    where: {
      objectKey,
      provider: StorageProvider.local_dev,
      status: "active",
    },
  });

  if (!file) return new NextResponse("Not found", { status: 404 });

  const session = await getCurrentSession();
  if (file.visibility !== "public" && !session) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (session && !canAccessStorageFile(session, file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = path.resolve(process.cwd(), ".storage", file.bucketName);
  const filePath = path.resolve(root, file.objectKey);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const body = await fs.readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": file.mimeType || "application/octet-stream",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
