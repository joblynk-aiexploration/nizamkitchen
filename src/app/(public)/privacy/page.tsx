import { LegalDocumentPage } from "../legal/_legal-document-page";

export const dynamic = "force-dynamic";

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage slug="privacy-policy" fallbackTitle="Privacy Policy" />;
}
