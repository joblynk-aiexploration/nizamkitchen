import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function CancellationPolicyPage() {
  return <LegalDocumentPage slug="cancellation-policy" fallbackTitle="Cancellation Policy" />;
}
