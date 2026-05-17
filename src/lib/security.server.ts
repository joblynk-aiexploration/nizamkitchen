import crypto from "node:crypto";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}
