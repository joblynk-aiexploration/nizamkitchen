import crypto from "node:crypto";
import { env } from "@/lib/env";

export function hashToken(token: string) {
  const secret = env.SESSION_SECRET || "development-session-secret";
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}
