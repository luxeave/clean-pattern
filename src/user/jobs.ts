import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { UserRepoSQL } from "../adapters/user/UserRepo.sql";

// Idempotent endpoint the cron will call:
export const cleanupUnverified = api<void, void>({}, async () => {
  await UserRepoSQL().disableUnverifiedOlderThan(24);
});

// Run daily at 03:00 UTC
const _ = new CronJob("cleanup-unverified", {
  title: "Disable stale, unverified users",
  schedule: "0 3 * * *",
  endpoint: cleanupUnverified,
});
