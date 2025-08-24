// Methods reflect the TS DB API: query, queryRow, queryAll, exec, rawExec.

import { DB } from "../../user/db";
import type { UserRepo } from "../../app/user/ports";

export const UserRepoSQL = (): UserRepo => ({
  async create(u) {
    await DB.exec`
      INSERT INTO users (id, email, name, verified)
      VALUES (${u.id}, ${u.email}, ${u.name ?? null}, ${u.verified})
    `;
  },

  async findByEmail(email) {
    const row = await DB.queryRow`
      SELECT id, email, name, verified FROM users WHERE email = ${email}
    `;
    return row ? { id: row.id, email: row.email, name: row.name ?? undefined, verified: row.verified } : null;
  },

  async disableUnverifiedOlderThan(hours) {
    const res = await DB.rawExec(
      `UPDATE users SET verified = FALSE
         WHERE verified = FALSE AND created_at < NOW() - ($1 || ' hours')::interval`,
      hours
    );
    // rawExec returns void; if you want count, use a CTE returning count
    return 0;
  },
});
