import { prisma } from "@/lib/prisma";
import { listVisibleSocialAuthProvidersSafe } from "@/server/auth/oauth-service";
import { RegisterForm } from "./_register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const socialProviders = await listVisibleSocialAuthProvidersSafe("register");

  const [countries, cuisines] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { countryName: "asc" },
      select: { countryCode: true, countryName: true },
    }),
    prisma.cuisine.findMany({
      where: { isGlobal: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <RegisterForm
      countries={countries}
      cuisines={cuisines}
      message={message}
      socialProviders={socialProviders}
    />
  );
}
