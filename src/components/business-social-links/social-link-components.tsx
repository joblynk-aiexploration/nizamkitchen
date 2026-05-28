import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";

type SocialLink = {
  id: string;
  platform: string;
  label?: string | null;
  url: string;
  displayOrder: number;
  isPublic: boolean;
};

const platformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "x", label: "X / Twitter" },
  { value: "snapchat", label: "Snapchat" },
  { value: "other", label: "Other" },
];

export function SocialLinksManager({
  links,
  profileType,
  upsertAction,
  deleteAction,
}: {
  links: SocialLink[];
  profileType: "home_catering" | "chef_business" | "restaurant";
  upsertAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Social links</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Add public business links. Private links stay hidden from marketplace profiles.</p>
      </div>
      {links.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">No social links yet.</p> : null}
      <div className="space-y-3">
        {links.map((link) => (
          <div key={link.id} className="rounded-2xl border border-[var(--color-border)] p-4">
            <form action={upsertAction} className="grid gap-3 md:grid-cols-[140px_1fr_110px_120px_auto]">
              <input type="hidden" name="linkId" value={link.id} />
              <input type="hidden" name="profileType" value={profileType} />
              <SelectInput label="Platform" name="platform" defaultValue={link.platform} options={platformOptions} />
              <TextInput label="URL" name="url" defaultValue={link.url} />
              <TextInput label="Order" name="displayOrder" type="number" min={0} defaultValue={link.displayOrder} />
              <TextInput label="Label" name="label" defaultValue={link.label ?? ""} />
              <div className="flex items-end gap-2">
                <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={link.isPublic} /> Public</label>
                <Button type="submit" variant="secondary">Save</Button>
              </div>
            </form>
            <form action={deleteAction} className="mt-3">
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="danger">Delete link</Button>
            </form>
          </div>
        ))}
      </div>
      <form action={upsertAction} className="grid gap-3 border-t border-[var(--color-border)] pt-5 md:grid-cols-[150px_1fr_110px_120px_auto]">
        <input type="hidden" name="profileType" value={profileType} />
        <SelectInput label="Platform" name="platform" options={platformOptions} />
        <TextInput label="URL" name="url" placeholder="https://instagram.com/yourbusiness" />
        <TextInput label="Order" name="displayOrder" type="number" min={0} defaultValue={links.length + 1} />
        <TextInput label="Label" name="label" />
        <div className="flex items-end gap-2">
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked /> Public</label>
          <Button type="submit">Add link</Button>
        </div>
      </form>
    </Card>
  );
}

export function PublicSocialLinks({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;
  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-ink)]">Connect</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            {link.label || socialPlatformLabel(link.platform)}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function AdminSocialLinks({
  links,
  deleteAction,
}: {
  links: SocialLink[];
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Social links</h2>
      {links.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No social links yet.</p> : null}
      <div className="mt-5 space-y-3">
        {links.map((link) => (
          <div key={link.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[var(--color-ink)]">{socialPlatformLabel(link.platform)}</p>
              <p className="break-all text-sm text-[var(--color-muted)]">{link.url}</p>
              <div className="mt-2"><Badge tone={link.isPublic ? "success" : "neutral"}>{link.isPublic ? "Public" : "Private"}</Badge></div>
            </div>
            <form action={deleteAction}>
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="danger">Remove</Button>
            </form>
          </div>
        ))}
      </div>
    </Card>
  );
}

function socialPlatformLabel(platform: string) {
  const option = platformOptions.find((item) => item.value === platform);
  return option?.label ?? platform;
}
