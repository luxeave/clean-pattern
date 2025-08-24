/*
When I label a use-case as **“pure TS”**, I mean that the **use-case layer**:

* Has **no direct dependencies** on Encore or any external framework.
* Uses **only TypeScript primitives**: interfaces, functions, classes, and types.
* Does not import from **adapters** (DB, HTTP, Pub/Sub, etc.)—instead, it depends only on **ports** (interfaces).
* Can be executed, tested, and reused **outside Encore entirely**.

This is important for **vertical-slice architecture** because:

1. **Framework-agnostic core** → You can switch from Encore to Fastify, Hono, or Express tomorrow, and your core logic won’t change.
2. **Easier testing** → You can run unit tests without starting Encore, Postgres, Pub/Sub, or Docker.
3. **Faster iteration** → You can stub dependencies (e.g., an in-memory repo) while building features.
4. **Clear boundaries** → Adapters handle *how* things are done, while use-cases define *what* should happen.

For example:

```ts
// ✅ Pure TS (use-case)
export class RegisterUser {
  constructor(private repo: UserRepo, private idGen: IdGen) {}
  async exec(input: Input): Promise<Output> {
    // logic only: no imports from Encore or DB
  }
}

// ❌ Impure use-case
import { DB } from "encore.dev/storage/sqldb"; // <-- coupling to infra
export async function registerUser(input) {
  // mixing business rules + SQL queries + framework code
}
```

**Why this matters in Encore**:
Encore gives you great infra primitives (SQL, Pub/Sub, Cron, Secrets), but by keeping use-cases “pure TS,” you **keep Encore at the edges** via adapters. This separation makes your app faster to build, safer to refactor, and easier to test.

If you want, I can illustrate this with a **diagram** showing exactly where Encore ends and “pure TS” begins in the architecture for our vertical-slice pattern. It’ll make the boundaries very clear. Should I?
*/

import type { EmailSender, IdGen, UserRepo } from "../ports";

export type RegisterInput  = { email: string; name?: string };
export type RegisterOutput = { id: string; email: string; name?: string; verified: boolean };

export class RegisterUser {
  constructor(
    private deps: { repo: UserRepo; id: IdGen; mail: EmailSender }
  ) {}

  async exec(input: RegisterInput): Promise<RegisterOutput> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) throw new Error("INVALID_EMAIL");

    const existing = await this.deps.repo.findByEmail(email);
    if (existing) throw new Error("EMAIL_TAKEN");

    const id = this.deps.id.newId();
    const user = { id, email, name: input.name, verified: false };
    await this.deps.repo.create(user);

    // side-effect via port (can be made async fire-and-forget or Pub/Sub)
    await this.deps.mail.sendWelcome(email, input.name);

    return user;
  }
}
