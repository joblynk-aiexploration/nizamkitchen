import { isRedirectError } from "next/dist/client/components/redirect-error";

export function rethrowIfRedirectError(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

export function getActionErrorMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    return fallback;
  }

  const validationMessage = getValidationErrorMessage(error);
  if (validationMessage) {
    return validationMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    const parsedMessage = getValidationMessageFromJson(error.message);
    if (parsedMessage) {
      return parsedMessage;
    }

    return error.message;
  }

  return fallback;
}

function getValidationErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return null;
  }

  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) {
    return null;
  }

  return formatValidationIssues(issues);
}

function getValidationMessageFromJson(message: string) {
  try {
    const parsed = JSON.parse(message);
    return Array.isArray(parsed) ? formatValidationIssues(parsed) : null;
  } catch {
    return null;
  }
}

function formatValidationIssues(issues: unknown[]) {
  const messages = issues
    .map((issue) => {
      if (!issue || typeof issue !== "object" || !("message" in issue)) {
        return null;
      }

      const message = (issue as { message?: unknown }).message;
      return typeof message === "string" && message.trim() ? message.trim() : null;
    })
    .filter((message): message is string => Boolean(message));

  if (messages.length === 0) {
    return null;
  }

  return Array.from(new Set(messages)).join(" ");
}
