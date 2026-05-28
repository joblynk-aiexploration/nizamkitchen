import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return <LegalDocumentPage slug="terms-of-service" fallbackTitle="Terms of Service" />;
}
