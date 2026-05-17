import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AiTrainingNav() {
  const links = [
    { href: "/admin/ai-training", label: "Overview" },
    { href: "/admin/ai-training/examples", label: "Examples" },
    { href: "/admin/ai-training/datasets", label: "Datasets" },
    { href: "/admin/ai-training/runs", label: "Training runs" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button key={link.href} asChild variant="secondary">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </div>
  );
}

export function AiTrainingComingSoon() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <Badge tone="warning">Feature flag disabled</Badge>
      <h2 className="mt-4 text-lg font-semibold text-amber-950">AI training workspace is not enabled yet.</h2>
      <p className="mt-2 text-sm text-amber-800">
        Enable the ai_training feature flag to manage verified training examples, datasets, and JSONL exports.
      </p>
    </Card>
  );
}
