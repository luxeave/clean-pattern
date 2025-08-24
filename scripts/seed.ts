// encore exec -- node scripts/seed.ts

import { DB } from "../src/user/db";

async function main() {
  console.log("🌱 Seeding initial data...");

  // Insert some sample users
  await DB.exec`
    INSERT INTO users (id, email, name, verified)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', true),
      ('22222222-2222-2222-2222-222222222222', 'bob@example.com', 'Bob', false)
    ON CONFLICT (email) DO NOTHING
  `;

  console.log("✅ Seeding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
