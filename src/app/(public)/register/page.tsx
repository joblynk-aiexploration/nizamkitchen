import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
  });

  return (
    <AuthShell
      title="Create workspace"
      description="Register a secure tenant and establish the first organization owner."
      footer={
        <span>
          Already registered?{" "}
          <Link className="font-semibold text-[var(--color-primary)]" href="/login">
            Sign in
          </Link>
        </span>
      }
    >
      <FormMessage message={message} />
      <form action="/api/auth/register" method="post" className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextInput label="Full name" name="fullName" required placeholder="Nizam Kitchen Admin" />
        </div>
        <TextInput label="Email address" name="email" type="email" required />
        <TextInput label="Password" name="password" type="password" required />
        <div className="md:col-span-2">
          <TextInput label="Organization name" name="organizationName" required />
        </div>
        <div className="md:col-span-2">
          <SelectInput
            label="Primary country"
            name="countryCode"
            options={countries.map((country) => ({
              value: country.countryCode,
              label: `${country.countryName} (${country.countryCode})`,
            }))}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
