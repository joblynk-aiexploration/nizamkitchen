import { listVisibleSocialAuthProvidersSafe } from "@/server/auth/oauth-service";
import { listActiveRegistrationCountries } from "@/server/auth/registration-countries";
import { getRecaptchaConfig } from "@/server/seo/seo-service";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./_register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const accountType = typeof params.type === "string" ? params.type : undefined;
  const selectedPlanSlug = typeof params.plan === "string" ? params.plan : undefined;
  const [socialProviders, recaptcha, countriesResult, cuisinesResult] = await Promise.all([
    listVisibleSocialAuthProvidersSafe("register"),
    getRecaptchaConfig().catch(() => null),
    listActiveRegistrationCountries()
      .then((countries) => ({ ok: true as const, countries }))
      .catch(() => ({ ok: false as const, countries: [] })),
    prisma.cuisine.findMany({
      where: { isGlobal: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }).then((cuisines) => ({ ok: true as const, cuisines })).catch(() => ({ ok: false as const, cuisines: [] })),
  ]);
  const setupMessage =
    !countriesResult.ok || !cuisinesResult.ok
      ? "Database unavailable. Please start PostgreSQL, then try registration again."
      : undefined;

  return (
    <RegisterForm
      countries={countriesResult.countries}
      cuisines={cuisinesResult.cuisines}
      message={message ?? setupMessage}
      socialProviders={socialProviders}
      recaptchaSiteKey={recaptcha?.siteKey}
      initialAccountType={accountType}
      selectedPlanSlug={selectedPlanSlug}
    />
  );
}
