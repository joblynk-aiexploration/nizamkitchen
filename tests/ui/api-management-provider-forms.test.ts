import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IntegrationProvider } from "@prisma/client";
import {
  getProviderFields,
  getProviderFormDefinition,
  providerRequiredCredentialKeys,
  providerRequiredSettingKeys,
} from "@/lib/integrations/provider-fields";

function fieldKeys(provider: IntegrationProvider) {
  return getProviderFormDefinition(provider).fields.map((field) => field.key);
}

describe("provider-specific API management forms", () => {
  it("shows only Google OAuth fields for Google sign-in setup", () => {
    expect(fieldKeys(IntegrationProvider.google_oauth)).toEqual(expect.arrayContaining([
      "client_id",
      "client_secret",
      "callbackUrl",
      "allowedDomains",
    ]));
    expect(fieldKeys(IntegrationProvider.google_oauth)).not.toEqual(expect.arrayContaining([
      "host",
      "bucketName",
      "publishable_key",
      "defaultRadiusMeters",
    ]));
    expect(providerRequiredCredentialKeys(IntegrationProvider.google_oauth)).toEqual(["client_id", "client_secret"]);
    expect(providerRequiredSettingKeys(IntegrationProvider.google_oauth)).toEqual(["callbackUrl"]);
  });

  it("shows only SMTP fields for email setup", () => {
    expect(fieldKeys(IntegrationProvider.smtp)).toEqual(expect.arrayContaining([
      "host",
      "port",
      "username",
      "password",
      "fromEmail",
      "fromName",
    ]));
    expect(fieldKeys(IntegrationProvider.smtp)).not.toEqual(expect.arrayContaining([
      "callbackUrl",
      "bucketName",
      "publishable_key",
      "server_api_key",
    ]));
  });

  it("keeps storage, payment, analytics, and recaptcha validation provider-specific", () => {
    expect(fieldKeys(IntegrationProvider.aws_s3)).toEqual(expect.arrayContaining([
      "bucketName",
      "region",
      "access_key_id",
      "secret_access_key",
    ]));
    expect(fieldKeys(IntegrationProvider.stripe)).toEqual(expect.arrayContaining([
      "publishable_key",
      "secret_key",
      "webhook_secret",
    ]));
    expect(fieldKeys(IntegrationProvider.paypal)).toEqual(expect.arrayContaining([
      "client_id",
      "client_secret",
    ]));
    expect(fieldKeys(IntegrationProvider.google_analytics)).toEqual(expect.arrayContaining(["measurement_id"]));
    expect(fieldKeys(IntegrationProvider.secure_privacy)).toEqual(expect.arrayContaining([
      "scriptUrl",
      "consentModeEnabled",
      "googleAnalyticsConsentEnabled",
      "googleAnalyticsIntegrationEnabled",
    ]));
    expect(fieldKeys(IntegrationProvider.google_recaptcha)).toEqual(expect.arrayContaining([
      "version",
      "site_key",
      "secret_key",
      "scoreThreshold",
    ]));
  });

  it("keeps optional settings collapsed and hides raw internals from the overview", () => {
    const overviewPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/page.tsx"), "utf8");
    const detailPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/[id]/page.tsx"), "utf8");
    const newPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/new/page.tsx"), "utf8");

    expect(overviewPage).toContain("configurationSummary");
    expect(overviewPage).not.toContain("encryptedValue");
    expect(detailPage).toContain("Advanced settings");
    expect(detailPage).toContain("Developer details");
    expect(detailPage).toContain("valuePreview");
    expect(detailPage).not.toContain("encryptedValue");
    expect(newPage).toContain("getProviderFields");
    expect(newPage).toContain("Advanced settings");
  });

  it("does not reintroduce AI video analysis text", () => {
    const registry = fs.readFileSync(path.join(process.cwd(), "src/lib/integrations/provider-fields.ts"), "utf8");
    const detailPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/apis/[id]/page.tsx"), "utf8");

    expect(registry).not.toMatch(/AI video analysis|Analyze with AI/i);
    expect(detailPage).not.toMatch(/AI video analysis|Analyze with AI/i);
  });

  it("keeps advanced fields out of the default field group", () => {
    const basicOauthKeys = getProviderFields(IntegrationProvider.google_oauth, false).map((field) => field.key);
    const advancedOauthKeys = getProviderFields(IntegrationProvider.google_oauth, true).map((field) => field.key);

    expect(basicOauthKeys).toEqual(["client_id", "client_secret", "callbackUrl"]);
    expect(advancedOauthKeys).toEqual(expect.arrayContaining([
      "allowedDomains",
      "autoCreateUser",
      "defaultOrganizationType",
    ]));
  });
});
