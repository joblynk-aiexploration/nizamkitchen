import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const datasetId = process.argv[2];
  if (!datasetId) {
    console.error("Usage: tsx scripts/ai/export-training-jsonl.ts <dataset-id>");
    process.exit(1);
  }

  const dataset = await prisma.aiTrainingDataset.findUnique({
    where: { id: datasetId },
    include: { examples: { include: { example: true } } },
  });
  if (!dataset) throw new Error(`Dataset ${datasetId} not found.`);

  for (const item of dataset.examples) {
    const example = item.example;
    if (example.status !== "verified") continue;
    process.stdout.write(`${JSON.stringify({
      task: example.taskType,
      input: example.inputJson,
      output: example.expectedOutputJson,
      metadata: {
        source: example.sourceType,
        verifiedAt: example.verifiedAt?.toISOString() ?? null,
        qualityScore: example.qualityScore,
      },
    })}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
