"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyGroceryListButton({
  listId,
  text,
}: {
  listId: string;
  text: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyList() {
    try {
      await navigator.clipboard.writeText(text);
      await fetch(`/api/grocery-lists/${listId}/export/copy`, { method: "POST" });
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" onClick={copyList}>
        Copy list
      </Button>
      {status === "copied" && <span className="text-sm text-emerald-700">Copied to clipboard.</span>}
      {status === "failed" && <span className="text-sm text-red-700">Copy failed. Use CSV export instead.</span>}
    </div>
  );
}
