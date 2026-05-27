import { NextResponse } from "next/server";
import { getStorageProvider } from "@/server/storage/storage-service";

export async function GET() {
  try {
    const { configuration, provider } = await getStorageProvider();
    const result = await provider.testConnection();

    return NextResponse.json({
      ok: result.ok,
      storage: result.ok ? "reachable" : "unreachable",
      configured: true,
      provider: configuration.provider,
      bucketName: configuration.bucketName,
      message: result.message,
      timestamp: new Date().toISOString(),
    }, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        storage: "unreachable",
        configured: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
