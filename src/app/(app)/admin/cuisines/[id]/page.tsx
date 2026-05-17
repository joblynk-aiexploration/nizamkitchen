import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getCuisineById } from "@/server/cuisines";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCuisineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const cuisine = await getCuisineById(id);

  if (!cuisine) notFound();

  const recentRecipes = await prisma.recipe.findMany({
    where: { cuisineId: id },
    select: { id: true, name: true, difficulty: true, isPublished: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return (
    <AdminShell
      session={session}
      title={cuisine.name}
      description={cuisine.description ?? `Cuisine with ${cuisine._count.recipes} recipes`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="font-semibold">Cuisine details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Name</dt>
              <dd className="font-medium">{cuisine.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Slug</dt>
              <dd className="font-mono text-xs">{cuisine.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Scope</dt>
              <dd>
                <Badge tone={cuisine.isGlobal ? "info" : "neutral"}>
                  {cuisine.isGlobal ? "Global" : "Regional"}
                </Badge>
              </dd>
            </div>
            {cuisine.countryCode && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Country</dt>
                <dd>{cuisine.countryCode}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Recipes</dt>
              <dd>{cuisine._count.recipes}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold">Recipes in this cuisine</h2>
          <div className="mt-4 space-y-2">
            {recentRecipes.map((recipe) => (
              <div key={recipe.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium">{recipe.name}</span>
                <div className="flex gap-2">
                  <Badge tone="neutral">{recipe.difficulty}</Badge>
                  <Badge tone={recipe.isPublished ? "success" : "neutral"}>
                    {recipe.isPublished ? "published" : "draft"}
                  </Badge>
                </div>
              </div>
            ))}
            {recentRecipes.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No recipes in this cuisine yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
