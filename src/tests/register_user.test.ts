import { expect, test } from "vitest";
import { RegisterUser } from "../app/user/usecases/RegisterUser";
import type { EmailSender, UserRepo } from "../app/user/ports";

class InMemRepo implements UserRepo {
  map = new Map<string, any>();
  async create(u:any){ this.map.set(u.email, u); }
  async findByEmail(email:string){ return this.map.get(email) ?? null; }
  async disableUnverifiedOlderThan(){ return 0; }
}
const IdGen = { newId: () => "id-1" };
const Mail: EmailSender = { sendWelcome: async () => {} };

test("registers user", async () => {
  const uc = new RegisterUser({ repo: new InMemRepo(), id: IdGen, mail: Mail });
  const out = await uc.exec({ email: "A@B.com", name: "Alice" });
  expect(out).toEqual({ id: "id-1", email: "a@b.com", name: "Alice", verified: false });
});
