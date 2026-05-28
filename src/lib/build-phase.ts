export function shouldSkipBuildTimeDatabase() {
  return process.env.NIZAMKITCHEN_SKIP_BUILD_DB === "1" || process.env.NEXT_PHASE === "phase-production-build";
}
