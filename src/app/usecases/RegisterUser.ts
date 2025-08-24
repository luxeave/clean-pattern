import type { EmailSender, IdGen, UserRepo } from "../user/ports";

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
