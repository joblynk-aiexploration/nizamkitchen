import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StorageImage } from "@/components/storage/storage-image";

export function CoverPhoto({ src, alt }: { src?: string | null; alt: string }) {
  return <StorageImage src={src} alt={alt} className="h-56 w-full rounded-[2rem] object-cover md:h-72" fallbackLabel="Cover photo coming soon" />;
}

export function ProfileAvatar({ src, alt, initials }: { src?: string | null; alt: string; initials: string }) {
  if (src) {
    return <StorageImage src={src} alt={alt} className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-xl" fallbackLabel={initials} />;
  }
  return (
    <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-slate-950 text-3xl font-semibold text-white shadow-xl">
      {initials}
    </div>
  );
}

export function VerificationBadge({ status }: { status?: string | null }) {
  if (status === "verified") return <Badge tone="success">Verified</Badge>;
  if (status === "pending") return <Badge tone="warning">Verification pending</Badge>;
  if (status === "rejected") return <Badge tone="danger">Verification rejected</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}

export function ProfileHeader({
  coverUrl,
  avatarUrl,
  name,
  headline,
  location,
  initials,
  badges = [],
  actions,
}: {
  coverUrl?: string | null;
  avatarUrl?: string | null;
  name: string;
  headline?: string | null;
  location?: string | null;
  initials: string;
  badges?: ReactNode[];
  actions?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CoverPhoto src={coverUrl} alt={`${name} cover`} />
      <div className="-mt-16 px-6 pb-6 md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <ProfileAvatar src={avatarUrl} alt={`${name} profile`} initials={initials} />
            <div className="pb-2">
              <h1 className="text-3xl font-semibold text-[var(--color-ink)]">{name}</h1>
              {headline ? <p className="mt-2 max-w-3xl text-base text-[var(--color-muted)]">{headline}</p> : null}
              {location ? <p className="mt-2 text-sm text-[var(--color-muted)]">{location}</p> : null}
              {badges.length ? <div className="mt-3 flex flex-wrap gap-2">{badges.map((badge, index) => <span key={index}>{badge}</span>)}</div> : null}
            </div>
          </div>
          {actions ? <div className="pb-2">{actions}</div> : null}
        </div>
      </div>
    </Card>
  );
}

export function ProfileSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function ProfileStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
    </Card>
  );
}

export function ContactActions({ href, label = "Contact" }: { href?: string | null; label?: string }) {
  if (!href) return null;
  return <Button asChild><Link href={href}>{label}</Link></Button>;
}

export function SocialLinksRow({ links }: { links: Array<{ id: string; platform: string; label?: string | null; url: string }> }) {
  if (!links.length) return <p className="text-sm text-[var(--color-muted)]">No public social links yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
          {link.label || link.platform}
        </a>
      ))}
    </div>
  );
}

export function ProfileCompletionCard({ score }: { score: number }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-[var(--color-ink)]">Profile completion</p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <p className="mt-3 text-sm text-[var(--color-muted)]">Your profile is {score}% complete.</p>
    </Card>
  );
}

export function BusinessServicesSection({ children }: { children: ReactNode }) {
  return <ProfileSection title="Services">{children}</ProfileSection>;
}

export function MenuPreviewSection({ children }: { children: ReactNode }) {
  return <ProfileSection title="Menu highlights">{children}</ProfileSection>;
}

export function ReviewsPreviewSection({ rating, count }: { rating?: number | null; count?: number | null }) {
  return (
    <ProfileSection title="Reviews">
      {count ? <p className="text-sm text-[var(--color-muted)]">{rating?.toFixed(1) ?? "New"} average rating across {count} reviews.</p> : <p className="text-sm text-[var(--color-muted)]">Reviews will appear here after completed orders.</p>}
    </ProfileSection>
  );
}

export function initialsFromName(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "NK";
}
