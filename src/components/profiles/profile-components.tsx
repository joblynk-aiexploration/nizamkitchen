import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StorageImage } from "@/components/storage/storage-image";
import { cn } from "@/lib/utils";

export function CoverPhoto({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.32),transparent_32%),linear-gradient(135deg,#071826,#0f2b3d_45%,#063d39)] md:h-72">
      {src ? (
        <StorageImage src={src} alt={alt} className="h-full w-full object-cover" fallbackLabel="Cover photo coming soon" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm font-semibold text-white/75">Cover photo coming soon</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/10" />
    </div>
  );
}

export function ProfileAvatar({ src, alt, initials }: { src?: string | null; alt: string; initials: string }) {
  if (src) {
    return <StorageImage src={src} alt={alt} className="h-32 w-32 rounded-[2rem] border-4 border-white object-cover shadow-xl" fallbackLabel={initials} />;
  }
  return (
    <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border-4 border-white bg-slate-950 text-3xl font-semibold text-white shadow-xl">
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
    <Card className="overflow-hidden p-0 shadow-xl shadow-slate-200/80">
      <div className="p-4 md:p-5">
        <CoverPhoto src={coverUrl} alt={`${name} cover`} />
      </div>
      <div className="px-5 pb-6 md:px-8 md:pb-8">
        <div className="rounded-[2rem] border border-[var(--color-border)] bg-white p-5 shadow-lg shadow-slate-200/70 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="-mt-14 shrink-0 md:mt-0">
                <ProfileAvatar src={avatarUrl} alt={`${name} profile`} initials={initials} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">My profile</p>
                <h1 className="mt-2 break-words font-serif text-4xl font-semibold text-[var(--color-ink)] md:text-5xl">{name}</h1>
                {headline ? <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--color-muted)]">{headline}</p> : null}
                {location ? (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
                    <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                    {location}
                  </p>
                ) : null}
                {badges.length ? <div className="mt-4 flex flex-wrap gap-2">{badges.map((badge, index) => <span key={index}>{badge}</span>)}</div> : null}
              </div>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProfileSection({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={cn("shadow-sm shadow-slate-200/60", className)}>
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
    <Card className="shadow-sm shadow-slate-200/60">
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
  const normalizedScore = Math.max(0, Math.min(100, score));
  const nextSteps = normalizedScore >= 100
    ? ["Profile basics are complete", "Keep photos and contact details current"]
    : ["Add profile and cover photos", "Add phone, location, and profile details", "Keep business or household details up to date"];

  return (
    <Card className="self-start">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">Profile completion</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">A complete profile builds trust across NizamKitchen.</p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">{normalizedScore}%</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${normalizedScore}%` }} />
      </div>
      <div className="mt-5 grid gap-2">
        {nextSteps.map((step) => (
          <div key={step} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-[var(--color-muted)]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[var(--color-primary)] ring-1 ring-[var(--color-border)]">✓</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
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
