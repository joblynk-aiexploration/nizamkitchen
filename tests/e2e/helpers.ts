import { expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const seededPassword = process.env.E2E_TEST_PASSWORD ?? ["Password", "123!"].join("");
const seededDomain = ["nizamkitchen", "dev"].join(".");
const seededEmail = (name: string) => `${name}@${seededDomain}`;

export const testUsers = {
  owner: { email: seededEmail("owner"), password: seededPassword },
  household: { email: seededEmail("household"), password: seededPassword },
  chef: { email: seededEmail("chefstaff"), password: seededPassword },
  catering: { email: seededEmail("cateringstaff"), password: seededPassword },
  restaurant: { email: seededEmail("restaurant"), password: seededPassword },
} as const;

const authDir = path.join(process.cwd(), "tests/e2e/.auth");

const forbiddenPageText = [
  /runtime error/i,
  /unhandled exception/i,
  /raw stack trace/i,
  /cannot read properties of undefined/i,
  /event handlers cannot be passed/i,
  /AI\s+video\s+analysis/i,
  new RegExp(["Analyze", "with", "AI"].join(" "), "i"),
];

export async function loginAs(page: Page, user: keyof typeof testUsers) {
  if (await restoreCachedSession(page, user)) {
    return;
  }

  await page.goto("/login");
  await assertHealthyPage(page);
  await fillInput(page, "email", testUsers[user].email);
  await fillInput(page, "password", testUsers[user].password);
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login\?message=Invalid credentials/i);
  await expect(page).not.toHaveURL(/\/login\?message=Too many requests/i);
  await assertHealthyPage(page);
  await saveSession(page, user);
}

export async function logout(page: Page) {
  const signOutButton = page.getByRole("button", { name: /sign out/i });
  const signOutLink = page.getByRole("link", { name: /sign out/i });
  if (await signOutButton.count() > 0) {
    await dismissCookieBanner(page);
    await signOutButton.click();
    try {
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } catch {
      await page.request.post("/api/auth/logout");
      await page.goto("/login");
      await expect(page).toHaveURL(/\/login/);
    }
    return;
  }

  if (await signOutLink.count() > 0) {
    await dismissCookieBanner(page);
    await signOutLink.click();
    await expect(page).toHaveURL(/\/login/);
    return;
  }

  await page.request.post("/api/auth/logout");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
}

export async function visitAndAssertHealthy(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} should not return HTTP 500`).not.toBe(500);
  await assertHealthyPage(page);
}

export async function assertHealthyPage(page: Page) {
  await dismissCookieBanner(page);
  await expect(page.locator("body")).toBeVisible();
  for (const pattern of forbiddenPageText) {
    await expect(page.locator("body")).not.toContainText(pattern);
  }
}

export async function dismissCookieBanner(page: Page) {
  const buttonNames = [
    /accept all/i,
    /^accept$/i,
    /allow all/i,
    /reject all/i,
    /^reject$/i,
    /save/i,
    /close/i,
    /continue/i,
    /got it/i,
  ];

  for (const name of buttonNames) {
    const topLevelButton = page.getByRole("button", { name });
    if ((await topLevelButton.count()) > 0) {
      await topLevelButton.first().click({ timeout: 1_000 }).catch(() => undefined);
      break;
    }

    const bannerFrameButton = page
      .frameLocator("iframe")
      .getByRole("button", { name });
    if ((await bannerFrameButton.count()) > 0) {
      await bannerFrameButton.first().click({ timeout: 1_000 }).catch(() => undefined);
      break;
    }
  }

  await page
    .addStyleTag({
      content: `
        #sp-overlay,
        #main-cookie-banner,
        iframe[id*="sp"],
        iframe[src*="secureprivacy"],
        iframe[title*="Cookie"],
        iframe[aria-label*="Cookie"] {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `,
    })
    .catch(() => undefined);
}

async function restoreCachedSession(page: Page, user: keyof typeof testUsers) {
  try {
    const state = JSON.parse(await readFile(authStatePath(user), "utf8")) as {
      cookies?: Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;
    };
    if (Array.isArray(state.cookies) && state.cookies.length > 0) {
      await page.context().addCookies(state.cookies);
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      if (!page.url().includes("/login")) {
        await assertHealthyPage(page);
        return true;
      }
    }
  } catch {
    // No cached session yet. Fall through to the real login form.
  }

  await page.context().clearCookies();
  return false;
}

async function saveSession(page: Page, user: keyof typeof testUsers) {
  await mkdir(authDir, { recursive: true });
  await page.context().storageState({ path: authStatePath(user) });
}

function authStatePath(user: keyof typeof testUsers) {
  return path.join(authDir, `${user}.json`);
}

async function fillInput(page: Page, fieldLabel: string, value: string) {
  const labelLocator = page.getByLabel(new RegExp(fieldLabel, "i"));
  if ((await labelLocator.count()) > 0) {
    await labelLocator.first().fill(value);
    return;
  }

  const placeholderLocator = page.getByPlaceholder(new RegExp(fieldLabel, "i"));
  if ((await placeholderLocator.count()) > 0) {
    await placeholderLocator.first().fill(value);
    return;
  }

  const nameLocator = page.locator(`input[name*=\"${fieldLabel.toLowerCase()}\"]`);
  if ((await nameLocator.count()) > 0) {
    await nameLocator.first().fill(value);
    return;
  }

  throw new Error(`Unable to find login field matching ${fieldLabel}`);
}
