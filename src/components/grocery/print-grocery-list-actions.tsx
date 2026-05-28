"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintGroceryListActions({ listHref }: { listHref: string }) {
  return (
    <div className="no-print mb-5 flex flex-wrap gap-2">
      <Button type="button" onClick={() => window.print()}>
        Print
      </Button>
      <Button asChild type="button" variant="secondary">
        <Link href={listHref}>Back to list</Link>
      </Button>
    </div>
  );
}
