import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const faqs = [
  ["Does NizamKitchen process payments?", "Payment integrations are configured by the Platform Owner. Checkout uses hosted/provider flows and does not store raw card numbers or CVV."],
  ["Can sellers publish menus immediately?", "Marketplace policies can require verification before publishing menus, accepting orders, or receiving payouts."],
  ["Where are uploaded files stored?", "Production uploads use S3 or S3-compatible storage when configured. Private documents use signed access controlled by permissions."],
  ["Is legal text final?", "Legal pages are editable templates/placeholders until replaced with counsel-approved production text."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-16">
      <PageHeader eyebrow="FAQ" title="Frequently asked questions" description="Short answers for common launch-readiness and marketplace questions." />
      <div className="space-y-4">
        {faqs.map(([question, answer]) => (
          <Card key={question}>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{question}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{answer}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
