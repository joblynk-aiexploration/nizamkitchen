import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function RefundPolicyPage() {
  return <LegalDocumentPage slug="refund-policy" fallbackTitle="Refund Policy" />;
}
