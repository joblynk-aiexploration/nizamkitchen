import fs from "node:fs";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(path: string) {
  return fs.readFileSync(`${repoRoot}/${path}`, "utf8");
}

describe("UI contrast and accessibility guards", () => {
  it("homepage keeps visible primary and secondary CTA labels", () => {
    const source = read("src/app/(public)/page.tsx");

    expect(source).toContain("Sign up");
    expect(source).toContain("See all features");
    expect(source).toContain("Button asChild");
    expect(source).toContain("hover:bg-white hover:text-[#10263a]");
    expect(source).not.toMatch(/bg-white\s+px-[^\n]+text-white/);
  });

  it("public navigation renders readable beta and sign-in actions", () => {
    const source = read("src/components/public/public-nav.tsx");

    expect(source).toContain("Sign up");
    expect(source).toContain("Sign in");
    expect(source).toContain("inline-flex min-h-11 items-center justify-center");
    expect(source).toContain("text-[var(--text-secondary)]");
    expect(source).toContain("aria-label=\"Toggle menu\"");
    expect(source).toContain("const isLogin = pathname === \"/login\"");
    expect(source).toContain("const isRegister = pathname === \"/register\"");
    expect(source).toContain("aria-current={isLogin ? \"page\" : undefined}");
    expect(source).toContain("aria-current={isRegister ? \"page\" : undefined}");
  });

  it("auth pages avoid duplicate in-page branding while keeping readable copy", () => {
    const authShell = read("src/components/auth/auth-shell.tsx");
    const registerForm = read("src/app/(public)/register/_register-form.tsx");
    const loginPage = read("src/app/(public)/login/page.tsx");

    expect(authShell).not.toContain("LogoMark");
    expect(authShell).not.toContain("Enterprise SaaS");
    expect(authShell).toContain("Plan · Cook · Hire · Order");
    expect(authShell).toContain("text-[var(--color-primary-strong)]");
    expect(authShell).toContain("text-[var(--text-secondary)]");

    expect(registerForm).not.toContain("{/* Logo */}");
    expect(registerForm).not.toContain("font-serif text-lg text-[var(--color-ink)]\">NizamKitchen");
    expect(registerForm).toContain("Join the beta");
    expect(registerForm).toContain("Create account");
    expect(loginPage).toContain("Sign in");
  });

  it("Button variants use explicit readable text, hover, focus, and disabled tokens", () => {
    const source = read("src/components/ui/button.tsx");

    for (const token of [
      "--button-primary-bg",
      "--button-primary-text",
      "--button-secondary-text",
      "--button-outline-text",
      "--button-ghost-text",
      "--button-danger-text",
      "--button-disabled-text",
      "--focus-ring",
    ]) {
      expect(source).toContain(token);
    }

    expect(source).toContain("variant?: \"primary\" | \"secondary\" | \"outline\" | \"ghost\" | \"link\" | \"danger\" | \"destructive\" | \"success\" | \"warning\"");
    expect(source).toContain("disabled:bg-[var(--button-disabled-bg)]");
  });

  it("form controls expose visible text, placeholder, focus, and disabled styles", () => {
    const controls = [
      read("src/components/ui/text-input.tsx"),
      read("src/components/ui/text-area.tsx"),
      read("src/components/ui/select-input.tsx"),
    ].join("\n");

    expect(controls).toContain("text-[var(--text-primary)]");
    expect(controls).toContain("disabled:bg-slate-100");
    expect(controls).toContain("focus:ring-[var(--focus-ring)]/25");
    expect(controls).toContain("placeholder:text-slate-500");
  });

  it("admin and app sidebars keep readable active and inactive labels", () => {
    const source = `${read("src/components/admin/admin-sidebar.tsx")}\n${read("src/components/layout/sidebar-nav.tsx")}`;

    expect(source).toContain("text-[var(--text-secondary)]");
    expect(source).toContain("text-[var(--color-primary-strong)]");
    expect(source).toContain("text-slate-200");
    expect(source).toContain("bg-white/15 font-semibold text-white");
  });

  it("public surfaces avoid removed video-analysis marketing text", () => {
    const publicSources = [
      "src/app/(public)/page.tsx",
      "src/app/(public)/features/page.tsx",
      "src/app/(public)/pricing/page.tsx",
      "src/app/(public)/for-households/page.tsx",
      "src/app/(public)/for-chefs/page.tsx",
      "src/app/(public)/for-restaurants/page.tsx",
      "src/components/public/public-nav.tsx",
    ].map(read).join("\n");
    const removedPhrase = ["AI", "video", "analysis"].join(" ");

    expect(publicSources).not.toContain(removedPhrase);
    expect(publicSources).not.toContain(["Analyze", "with", "AI"].join(" "));
  });
});
