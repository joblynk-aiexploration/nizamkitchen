-- AddIndex
-- Composite index on BillingUsageRecord for the hot billing enforcement query:
-- WHERE organizationId = ? AND usageType = ? AND periodStart >= ?
-- Covers usage counts, admin limit overrides, and monthly reset lookups.
CREATE INDEX IF NOT EXISTS "BillingUsageRecord_organizationId_usageType_periodStart_idx"
ON "BillingUsageRecord" ("organizationId", "usageType", "periodStart");
