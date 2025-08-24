## Purpose

This instruction set codifies how to implement features, refactors, and fixes so they strictly follow the Clean Architecture / Ports & Adapters (Hexagonal) pattern documented in PATTERN.md, with vertical slices per feature. It defines how to structure code, what can depend on what, naming/file rules, dependency boundaries, testing patterns, examples, and a pre-merge validation checklist.

## Core Principles (from PATTERN.md)

- Keep the core “pure TS”: no framework, DB, HTTP, or Encore imports in business logic
- Depend on ports (interfaces) defined by the core, not concrete technology
- Implement adapters at the edges to satisfy ports (SQL, email, etc.)
- Compose wiring only at delivery boundaries (HTTP, Pub/Sub, Cron)
- Vertical slice per feature (e.g., “user”) with clear ownership and navigation

## Layering and Allowed Dependencies

- Core (Domain + Application): src/app/<feature>
  - Contains: ports.ts, usecases/<UseCase>.ts
  - Allowed imports: TypeScript/standard libs, internal types, ports within the same feature
  - Forbidden: Encore, SQL/DB, HTTP/fetch, SDKs, Pub/Sub, Cron, environment/secrets
- Adapters (Implement Ports): src/adapters/<feature>
  - Contains: concrete implementations (SQL, email, HTTP SDKs)
  - Allowed imports: core ports/types for the same feature, external SDKs, Encore infrastructure helpers only if they are purely infrastructural and do not leak into core
  - Forbidden: importing use-cases; calling back into core
- Delivery + Infrastructure: src/<feature>
  - Contains: http.ts, events.ts, jobs.ts, db.ts, migrations/ (when relevant)
  - Allowed imports: use-cases from core, adapters, infrastructure/frameworks, event/topic wiring
  - Responsibility: compose concrete adapters, instantiate use-cases, publish/subscribe, schedule jobs, and keep endpoints idempotent

Dependency direction:
- Core → Ports (interfaces/types only)
- Adapters → Core Ports (implementations)
- Delivery → Core Use-cases and Adapters
- Never: Core → Adapters, Core → Delivery, Adapters → Use-cases

## Project Layout and File Organization

Per feature slice (example “user”):
- src/app/user
  - ports.ts
  - usecases/RegisterUser.ts
- src/adapters/user
  - UserRepo.sql.ts
  - EmailSender.impl.ts
- src/user
  - http.ts
  - events.ts
  - jobs.ts
  - db.ts
  - migrations/...

Rules:
- All business rules for a feature live under src/app/<feature>
- All implementations of IO concerns live under src/adapters/<feature>
- All delivery/infrastructure wiring lives under src/<feature>
- New features follow the same structure

## Naming Conventions

- Ports: Noun + Suffix (Repo, IdGen, EmailSender, PaymentGateway)
  - File: ports.ts (contains all ports for the feature)
  - Methods: verb-based (create, findByEmail, disableUnverifiedOlderThan, sendWelcome)
- Use-cases: PascalCase VerbNoun in a dedicated file under usecases/
  - Class: RegisterUser, VerifyUser, CleanupUnverified
  - Method: exec(input: X): Promise<Y>
  - Constructor parameter: deps: { ...port instances... }
- Adapters: Implementation suffix
  - SQL adapters: <PortName>SQL (e.g., UserRepoSQL) in <Name>.sql.ts
  - Generic adapters: <PortName>Impl (e.g., EmailSenderImpl) in <Name>.impl.ts
  - Export: named factories (no default exports)
- Delivery files:
  - http.ts, events.ts, jobs.ts, db.ts with named exports
- Types:
  - Input/Output types named <UseCase>Input / <UseCase>Output or domain-noun types
- Events:
  - Topic name: “<feature>-<eventPlural>” (e.g., user-signups)
  - Event payload type: <EventName>Event

## Code Structure Requirements

- Use-cases:
  - One public method exec; return plain data (no framework-specific types)
  - Accept dependencies via constructor injection with explicit types
  - Validate inputs and encode business rules; trigger side-effects only via ports
  - No logging/metrics directly; emit domain decisions via return values or ports; let delivery/adapter perform logging/metrics
- Ports:
  - Define narrow, explicit abstractions needed by the core
  - No framework types in signatures (use primitives/POJOs)
  - Stable over time; add methods deliberately
- Adapters:
  - Implement only the ports; contain all IO and framework specifics
  - Do not hold hidden global state; prefer factories that capture resources explicitly
  - Errors are translated to domain-meaningful failures or thrown to be handled at delivery
- Delivery:
  - Construct concrete adapters and pass them to use-case
  - Publish/subscribe events and schedule jobs here
  - Keep endpoints idempotent; separate read-model endpoints if needed
  - Do not implement business rules here

## Dependency Management Guidelines

- Core:
  - No runtime dependencies on frameworks/SDKs
  - Keep dependencies to dev-only (testing, types) as needed
- Adapters/Delivery:
  - Add only the minimum necessary infra dependencies (DB clients, email SDKs)
  - Secrets/config are retrieved in adapters/delivery only
- Versioning:
  - Prefer stable versions for infra libs, pinned via the chosen package manager and lockfile
- Avoid cyclical dependencies between feature slices

## Testing Patterns

- Unit tests (fast, pure) for use-cases:
  - Use in-memory test doubles implementing ports (fakes/stubs)
  - Do not boot frameworks/DBs; run in Node + Vitest/Jest
- Integration tests (slower) for adapters and delivery:
  - May use Encore endpoints with real adapters
  - Validate idempotency and event publishing
- Test structure:
  - src/tests/<feature>/<use-case>.test.ts for unit tests
  - src/tests/<feature>/integration/*.test.ts for integration
- Assertions:
  - Verify exact, normalized outputs from use-cases
  - Verify that side-effects occurred by observing port interactions (fakes) or delivery-level effects (events published)

## Compliance Examples

Compliant use-case (pure TS, ports only):

```ts
// src/app/user/usecases/RegisterUser.ts
export class RegisterUser {
  constructor(private deps: { repo: UserRepo; id: IdGen; mail: EmailSender }) {}
  async exec(input: RegisterInput): Promise<RegisterOutput> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.deps.repo.findByEmail(email);
    if (existing) throw new Error("Email already registered");
    const id = this.deps.id.newId();
    const user = { id, email, name: input.name, verified: false };
    await this.deps.repo.create(user);
    await this.deps.mail.sendWelcome(email, input.name);
    return user;
  }
}
```

Compliant adapter implementing a port:

```ts
// src/adapters/user/UserRepo.sql.ts
export const UserRepoSQL = (db: SQLDatabase): UserRepo => ({
  async create(u) {
    await db.exec`INSERT INTO users (id, email, name, verified) VALUES (${u.id}, ${u.email}, ${u.name ?? null}, ${u.verified})`;
  },
  async findByEmail(email) {
    const row = await db.queryRow`SELECT id, email, name, verified FROM users WHERE email = ${email}`;
    return row ? { id: row.id, email: row.email, name: row.name ?? undefined, verified: row.verified } : null;
  },
  async disableUnverifiedOlderThan(hours) {
    const res = await db.exec`UPDATE users SET verified = false WHERE verified = false AND created_at < NOW() - INTERVAL '${hours} hours'`;
    return res.rowCount ?? 0;
  },
});
```

Compliant delivery wiring:

```ts
// src/user/http.ts
const repo = UserRepoSQL(DB);
const mail = EmailSenderImpl();
const uc = new RegisterUser({ repo, id: IdGen, mail });

export async function createUserHandler(req: RegisterInput) {
  const user = await uc.exec(req);
  await signups.publish({ userID: user.id, email: user.email });
  return { status: 201, body: user };
}
```

Violations (do not do this):

```ts
// ❌ Core importing infrastructure (Encore/DB)
import { SQLDatabase } from "@encore/..."; // forbidden in core
export class RegisterUser { /* ... */ }

// ❌ Core returning framework types
async exec(input): Promise<Response> { /* returning HTTP Response is forbidden */ }

// ❌ Adapter calling back into use-cases
import { RegisterUser } from "../../app/user/usecases/RegisterUser"; // adapters must not depend on use-cases

// ❌ Delivery embedding business rules
// src/user/http.ts
if (await DB.queryRow`SELECT ...`) { /* duplicate logic here instead of use-case */ }
```

## File and API Surface Requirements

- Use-case files:
  - One class per file; export the class
  - Public API = constructor + exec
  - Explicit input/output types; avoid “any”
- ports.ts:
  - Group feature’s ports; interfaces only
  - No imports from adapters/delivery/frameworks
- Adapters:
  - Factory function per adapter (e.g., EmailSenderImpl(): EmailSender)
  - No default exports; use named exports
- Delivery:
  - Keep files small: http.ts (endpoint + wiring), events.ts (topic + subscriptions), jobs.ts (cron), db.ts (database handle), migrations/ (schema)

## Eventing and Jobs

- Events:
  - Declare Topic and Subscriptions in src/<feature>/events.ts
  - Publish events only from delivery handlers (after use-case returns)
  - Subscriptions call adapters/use-cases via ports if needed; avoid business rules in subscription handler body
- Jobs:
  - Cron jobs trigger idempotent endpoints
  - Job implementations live in src/<feature>/jobs.ts and call delivery endpoints (or use-cases via delivery wiring)

## Refactoring Guidance

- Extract new ports when business logic needs new IO; add adapter implementations per environment
- When replacing a technology (e.g., Sendgrid → SES):
  - Update adapters only; do not alter use-case code or ports unless strictly necessary
- Keep ports minimal; avoid growing “god interfaces”

## Pre-Implementation Checklist (Agent)

Before you write code:
- Identify the feature slice and confirm/create:
  - src/app/<feature>/ports.ts
  - src/app/<feature>/usecases/<UseCase>.ts
  - src/adapters/<feature>/* for new adapters
  - src/<feature>/{http.ts,events.ts,jobs.ts,db.ts}
- Decide the ports required; define interfaces in ports.ts
- Sketch the use-case inputs/outputs and business rules without IO concerns
- Plan adapter implementations for the ports

## Implementation Steps (Agent)

1) Core
- Add/extend ports.ts as needed
- Implement the use-case in usecases/<UseCase>.ts with constructor-injected ports
- Keep code pure and framework-agnostic

2) Adapters
- Implement concrete adapters in src/adapters/<feature> with factory functions
- Encapsulate all IO (DB, email, HTTP calls)

3) Delivery
- Wire adapters to use-case in http.ts/events.ts/jobs.ts
- Publish events and ensure idempotency

4) Tests
- Unit-test the use-case with in-memory fakes
- Integration-test delivery/adapters where necessary

## Validation and Enforcement

Manual checks (fast, safe):
- Directory & file structure matches the layout above
- In src/app/<feature>:
  - grep forbid imports: “encore”, “sql”, “fetch”, “Topic”, “Subscription”, “Cron”, environment/secret APIs
  - only imports from TS stdlib, same feature’s ports/types
- Ports signatures are framework-free (return plain TS data)
- Use-cases expose exec(input): Promise<output>
- Adapters do not import use-cases
- Delivery composes adapters + use-cases and contains event/cron wiring
- Endpoints are idempotent

Automated checks you can add (recommended):
- ESLint “no-restricted-imports” per folder:
  - src/app/**: disallow @encore/*, node:fs, node:http, cross-feature adapter/delivery imports
  - src/adapters/**: disallow importing usecases
- Dependency graph checks (e.g., dependency-cruiser) with rules:
  - app → cannot import adapters or delivery
  - adapters → can import app/ports only
  - delivery → can import app/usecases and adapters
- Simple content rules:
  - Disallow Response/Request/HTTP types in core
  - Disallow env/secrets access in core
- Pre-commit/pre-push hooks to run unit tests and lint

Testing validation:
- Unit tests for new/changed use-cases exist and pass using fakes
- If new events: tests assert topic publication from delivery
- If new jobs: tests assert idempotency and correct scheduling endpoint usage
- If adapters changed: either integration tests exist or unit tests with simulated IO errors verifying behavior

PR checklist (must be satisfied before merge):
- Layering and dependencies conform to rules above
- Ports are defined/updated with no framework types
- Use-cases are pure and constructor-injected
- Adapters implement ports only; no use-case imports
- Delivery wires everything; events/cron defined where needed
- Unit tests for use-cases added/updated and passing
- Lint and architecture checks passing
- Vertical slice files are in correct locations and names

## Quick Compliance vs. Violation Matrix

- Core imports Encore/DB/HTTP → Violation
- Core returns plain data types → Compliant
- Adapter imports use-case → Violation
- Delivery composes use-case with adapters → Compliant
- Use-case logs or reads secrets → Violation
- Use-case triggers side-effects via ports → Compliant
- Delivery duplicates business rules → Violation
- Delivery publishes events post-success → Compliant

## Example Fakes for Unit Tests

```ts
// tests/fakes/user.ts
export class InMemUserRepo implements UserRepo {
  private byEmail = new Map<string, RegisterOutput>();
  async create(u: RegisterOutput) { this.byEmail.set(u.email, u); }
  async findByEmail(email: string) { return this.byEmail.get(email) ?? null; }
  async disableUnverifiedOlderThan() { return 0; }
}
export const InMemMail: EmailSender = {
  async sendWelcome() { /* record call in test */ },
};
export const TestIdGen: IdGen = { newId: () => "id-1" };
```

Unit test pattern:

```ts
// src/tests/user/register_user.test.ts
it("registers a new user and sends welcome", async () => {
  const repo = new InMemUserRepo();
  const uc = new RegisterUser({ repo, id: TestIdGen, mail: InMemMail });
  const out = await uc.exec({ email: "A@B.com", name: "Alice" });
  expect(out).toEqual({ id: "id-1", email: "a@b.com", name: "Alice", verified: false });
});
```

## Refusal Rules (Agent)

When asked to:
- Add framework/DB-specific logic in a use-case → refuse and propose port-based solution
- Import adapters from core → refuse; suggest dependency inversion
- Return framework types from core → refuse; return plain data types
- Put business rules in delivery → refuse; move logic to a use-case

## Final Validation Steps Before Marking Work Complete

- Structure:
  - Files placed under correct directories and named per conventions
- Imports:
  - In core files: scan imports for any forbidden modules; none present
  - In adapters: no imports from usecases
  - In delivery: only wiring and infra permissible imports
- Types:
  - Use-case signatures use plain TS types; no framework types leaked
- Behavior:
  - Delivery publishes required events and schedules cron correctly
  - Endpoints are idempotent
- Tests:
  - Unit tests added/updated for use-cases with in-memory fakes
  - All tests pass locally
- Tooling:
  - Lint/architecture checks pass (no restricted imports, no layer violations)
- Documentation:
  - If new port or use-case, short docstring added describing intent and rules

Follow this instruction set for every change. If a valid need arises to deviate (e.g., new cross-cutting concern), propose an approach that preserves the layering (e.g., adapter/decorator) and update these rules accordingly after approval.
