import { env } from "@/lib/env";
import { listActiveSmtpIntegrations } from "@/server/config/platform-config-service";
import { loadNodemailer } from "@/server/email/nodemailer-loader";
import type { EmailProviderAdapter } from "../email-types";
import { createDisabledEmailProvider } from "./disabled-provider";

type SmtpProviderConfig = {
  id: string;
  displayName: string;
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  password?: string | null;
  fromEmail: string;
  fromName?: string | null;
};

export async function resolveEmailProvider(countryCode?: string | null): Promise<EmailProviderAdapter> {
  const providers = await resolveSmtpProviders(countryCode);
  if (providers.length === 0) {
    return createDisabledEmailProvider("Email delivery is not configured yet.");
  }

  return {
    provider: "smtp",
    async send(input) {
      const nodemailer = loadNodemailer();
      if (!nodemailer) {
        return {
          sent: false,
          provider: "disabled",
          errorMessage: "Email delivery is not available on this server. Install dependencies and rebuild the app.",
        };
      }

      const failures: string[] = [];

      for (const provider of providers) {
        const timeoutMs = input.timeoutMs ?? 20_000;
        const transport = nodemailer.createTransport({
          host: provider.host,
          port: provider.port,
          secure: provider.secure,
          auth: provider.username && provider.password ? { user: provider.username, pass: provider.password } : undefined,
          connectionTimeout: Math.min(10_000, timeoutMs),
          greetingTimeout: Math.min(10_000, timeoutMs),
          socketTimeout: timeoutMs,
        });

        try {
          const result = await transport.sendMail({
            from: formatSender(provider),
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
          });
          transport.close();

          return {
            sent: true,
            provider: "smtp",
            providerMessageId: typeof result.messageId === "string" ? result.messageId : provider.id,
          };
        } catch {
          transport.close();
          failures.push(provider.displayName);
        }
      }

      return {
        sent: false,
        provider: "smtp",
        errorMessage: failures.length > 0 ? "All configured SMTP providers failed." : "SMTP delivery failed.",
      };
    },
  };
}

async function resolveSmtpProviders(countryCode?: string | null): Promise<SmtpProviderConfig[]> {
  const vaultProviders = await getVaultSmtpProviders(countryCode);
  if (vaultProviders.length > 0) {
    return vaultProviders;
  }

  if (!env.SMTP_HOST || env.SMTP_HOST === "localhost" || !env.EMAIL_FROM) {
    return [];
  }

  return [{
    id: "environment",
    displayName: "Environment SMTP",
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    username: env.SMTP_USER,
    password: env.SMTP_PASS,
    fromEmail: env.EMAIL_FROM,
    fromName: "NizamKitchen",
  }];
}

async function getVaultSmtpProviders(countryCode?: string | null): Promise<SmtpProviderConfig[]> {
  try {
    const integrations = await listActiveSmtpIntegrations(countryCode);
    return integrations
      .map((integration): SmtpProviderConfig | null => {
        const settings = Object.fromEntries(integration.settings.map((setting) => [setting.settingKey, setting.settingValueJson]));
        const credentials = Object.fromEntries(integration.credentials.map((credential) => [credential.keyName, credential.value]));
        const host = stringSetting(settings.host);
        const fromEmail = stringSetting(settings.fromEmail);
        const port = numberSetting(settings.port, 587);

        if (!host || !fromEmail) {
          return null;
        }

        return {
          id: integration.id,
          displayName: integration.displayName,
          host,
          port,
          secure: booleanSetting(settings.secure, port === 465),
          username: stringSetting(credentials.username),
          password: stringSetting(credentials.password),
          fromEmail,
          fromName: stringSetting(settings.fromName),
        };
      })
      .filter((provider): provider is SmtpProviderConfig => provider !== null);
  } catch {
    return [];
  }
}

function formatSender(provider: SmtpProviderConfig) {
  const name = provider.fromName?.trim();
  return name ? `${name.replace(/"/g, "")} <${provider.fromEmail}>` : provider.fromEmail;
}

function stringSetting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberSetting(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}
