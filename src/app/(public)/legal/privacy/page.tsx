import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return <LegalDocumentPage slug="privacy-policy" fallbackTitle="Privacy Policy" />;
}
