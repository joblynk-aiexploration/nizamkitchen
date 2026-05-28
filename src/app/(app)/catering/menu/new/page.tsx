import { PageHeader } from "@/components/ui/page-header";
import { MenuForm } from "@/components/menus/menu-forms";
import { upsertCateringMenuAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCateringMenuPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title="Create menu" description="Menus can stay private while you draft, then become public after review." />
      <MenuForm action={upsertCateringMenuAction} />
    </div>
  );
}
