import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function SellerAgreementPage() {
  return <LegalDocumentPage slug="seller-agreement" fallbackTitle="Seller Agreement" />;
}
