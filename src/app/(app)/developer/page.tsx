import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function DeveloperPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });
  const where = { organizationId: session.activeOrganization.id };
  const [totalApiKeys, apiKeys] = await Promise.all([
    prisma.apiKey.count({ where }),
    prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Developer enablement"
        title="Developer"
        description="Developer-facing assets are modeled now to support future automation, integrations, and APIs without exposing secrets."
      />
      <Card>
        <h2 className="text-xl font-semibold">Health checks</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--color-primary)]">
          <a href="/api/health">/api/health</a>
          <a href="/api/health/db">/api/health/db</a>
        </div>
      </Card>
      {apiKeys.length === 0 ? (
        <EmptyState
          title="No API keys yet"
          description="API key issuance and revocation are intentionally modeled as placeholders for future developer workflows."
        />
      ) : (
        apiKeys.map((apiKey) => (
          <Card key={apiKey.id}>
            <h2 className="text-lg font-semibold">{apiKey.label}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Created {formatDate(apiKey.createdAt)} • Last used {formatDate(apiKey.lastUsedAt)}
            </p>
          </Card>
        ))
      )}
      <PaginationControls
        pagination={getPaginationMeta(totalApiKeys, paginationInput)}
        basePath="/developer"
        searchParams={params}
        itemLabel="API keys"
      />
    </div>
  );
}
