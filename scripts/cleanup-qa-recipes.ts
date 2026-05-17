/**
 * Cleanup script: remove QA/test placeholder recipes from the database.
 *
 * Targets recipes whose name starts with "QA ", "Test ", "Admin QA", or
 * whose slug starts with "qa-", "test-", "admin-qa-".
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/cleanup-qa-recipes.ts
 *
 * Use --dry-run to preview without deleting.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QA_SLUG_PREFIXES = ["qa-", "test-", "admin-qa-"];
const QA_NAME_PREFIXES = ["QA ", "Test ", "Admin QA"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("DRY RUN — no records will be deleted.");
  }

  const recipes = await prisma.recipe.findMany({
    where: {
      OR: [
        ...QA_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })),
        ...QA_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })),
      ],
    },
    select: { id: true, name: true, slug: true, organizationId: true, isGlobal: true },
  });

  if (recipes.length === 0) {
    console.log("No QA/test recipes found.");
    return;
  }

  console.log(`Found ${recipes.length} QA/test recipe(s):`);
  for (const r of recipes) {
    console.log(`  - [${r.id}] "${r.name}" (slug: ${r.slug}, global: ${r.isGlobal}, org: ${r.organizationId ?? "none"})`);
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run without --dry-run to delete.");
    return;
  }

  const ids = recipes.map((r) => r.id);

  // Cascade deletes handle related records (ingredients, steps, media refs, etc.)
  const result = await prisma.recipe.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${result.count} QA/test recipe(s).`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
