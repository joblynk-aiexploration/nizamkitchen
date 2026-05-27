import type { EmailProviderAdapter } from "../email-types";

export function createDisabledEmailProvider(reason = "SMTP is not configured."): EmailProviderAdapter {
  return {
    provider: "disabled",
    async send() {
      return {
        sent: false,
        provider: "disabled",
        errorMessage: reason,
      };
    },
  };
}
