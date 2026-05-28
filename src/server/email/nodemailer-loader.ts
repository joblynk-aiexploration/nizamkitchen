import { createRequire } from "node:module";

type NodemailerModule = {
  createTransport: (options: Record<string, unknown>) => {
    verify: () => Promise<unknown>;
    sendMail: (input: Record<string, unknown>) => Promise<{ messageId?: unknown }>;
    close: () => void;
  };
};

const nodeRequire = createRequire(import.meta.url);

export function loadNodemailer(): NodemailerModule | null {
  try {
    const moduleName = "nodemailer";
    const loaded = nodeRequire(moduleName) as unknown;
    if (isNodemailerModule(loaded)) {
      return loaded;
    }
    if (hasDefaultModule(loaded) && isNodemailerModule(loaded.default)) {
      return loaded.default;
    }
    return null;
  } catch {
    return null;
  }
}

function isNodemailerModule(value: unknown): value is NodemailerModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "createTransport" in value &&
    typeof value.createTransport === "function"
  );
}

function hasDefaultModule(value: unknown): value is { default: unknown } {
  return typeof value === "object" && value !== null && "default" in value;
}
