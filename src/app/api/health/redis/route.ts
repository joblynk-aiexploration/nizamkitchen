import net from "node:net";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

function pingRedis(urlString: string) {
  return new Promise<void>((resolve, reject) => {
    const url = new URL(urlString);
    const socket = net.createConnection({
      host: url.hostname,
      port: Number(url.port || 6379),
    });

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis health check timed out."));
    }, 3_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function GET() {
  try {
    await pingRedis(env.REDIS_URL);

    return NextResponse.json({
      ok: true,
      redis: "reachable",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        redis: "unreachable",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
