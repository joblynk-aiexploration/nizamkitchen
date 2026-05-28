import { LegalDocumentPage } from "../_legal-document-page";

export const dynamic = "force-dynamic";

export default function FoodSafetyPolicyPage() {
  return <LegalDocumentPage slug="food-safety-policy" fallbackTitle="Food Safety Policy" />;
}
