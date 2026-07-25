import { expect, test, type Page } from "@playwright/test";
import { assertHealthyPage } from "./helpers";

type QaAccount = {
  key: string;
  role: string;
  emailEnv: string;
  passwordEnv: string;
  landingPattern: RegExp;
  allowedRoutes: string[];
  forbiddenRoutes: string[];
};

const qaAccounts: QaAccount[] = [
  {
    key: "owner",
    role: "Platform Owner",
    emailEnv: "QA_OWNER_EMAIL",
    passwordEnv: "QA_OWNER_PASSWORD",
    landingPattern: /\/admin/,
    allowedRoutes: ["/admin", "/admin/apis", "/admin/users"],
    forbiddenRoutes: ["/chef", "/catering", "/restaurant"],
  },
  {
    key: "household",
    role: "Household",
    emailEnv: "QA_HOUSEHOLD_EMAIL",
    passwordEnv: "QA_HOUSEHOLD_PASSWORD",
    landingPattern: /\/dashboard/,
    allowedRoutes: ["/dashboard", "/recipes", "/meal-plans", "/billing"],
    forbiddenRoutes: ["/admin", "/admin/apis", "/admin/users"],
  },
  {
    key: "chefstaff",
    role: "Chef Staff",
    emailEnv: "QA_CHEF_EMAIL",
    passwordEnv: "QA_CHEF_PASSWORD",
    landingPattern: /\/chef|\/dashboard/,
    allowedRoutes: ["/chef", "/chef/profile", "/chef/requests"],
    forbiddenRoutes: ["/admin", "/catering/orders", "/restaurant/orders"],
  },
  {
    key: "cateringstaff",
    role: "Home Catering Staff",
    emailEnv: "QA_CATERING_EMAIL",
    passwordEnv: "QA_CATERING_PASSWORD",
    landingPattern: /\/catering|\/dashboard/,
    allowedRoutes: ["/catering", "/catering/profile", "/catering/orders"],
    forbiddenRoutes: ["/admin", "/chef/requests", "/restaurant/orders"],
  },
  {
    key: "restaurant",
    role: "Restaurant Owner",
    emailEnv: "QA_RESTAURANT_EMAIL",
    passwordEnv: "QA_RESTAURANT_PASSWORD",
    landingPattern: /\/restaurant|\/dashboard/,
    allowedRoutes: ["/restaurant", "/restaurant/profile", "/restaurant/orders"],
    forbiddenRoutes: ["/admin", "/chef/requests", "/catering/orders"],
  },
];

function credentialsFor(account: QaAccount) {
  const email = process.env[account.emailEnv]?.trim();
  const password = process.env[account.passwordEnv];
  if (!email || !password) return null;
  return { email, password };
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await assertHealthyPage(page);
  await page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first().fill(email);
  await page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).first().fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForLoadState("networkidle");
}

test.describe("env-driven authenticated role smoke", () => {
  for (const account of qaAccounts) {
    test(`${account.role} can sign in and respects route boundaries`, async ({ page }, testInfo) => {
      const credentials = credentialsFor(account);
      test.skip(!credentials, `${account.role} QA credentials are missing; mark authenticated QA as BLOCKED.`);
      if (!credentials) return;

      await fillLogin(page, credentials.email, credentials.password);
      await expect(page, `${account.role} should leave the login page after successful sign-in`).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(account.landingPattern);
      await assertHealthyPage(page);

      for (const route of account.allowedRoutes) {
        const response = await page.goto(route);
        await page.waitForLoadState("networkidle");
        expect(response?.status(), `${account.role} ${route} should not return 500`).not.toBe(500);
        await assertHealthyPage(page);
      }

      for (const route of account.forbiddenRoutes) {
        const response = await page.goto(route);
        await page.waitForLoadState("networkidle");
        expect(response?.status(), `${account.role} ${route} should not return 500`).not.toBe(500);
        await assertHealthyPage(page);
        await expect(page, `${account.role} should not remain on forbidden route ${route}`).not.toHaveURL(
          new RegExp(`${route.replaceAll("/", "\\/")}$`),
        );
      }

      await testInfo.attach(`${account.key}-final-url`, {
        body: page.url(),
        contentType: "text/plain",
      });
    });
  }
});
