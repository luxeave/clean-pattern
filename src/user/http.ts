import { api, HttpStatus } from "encore.dev/api";
import { RegisterUser } from "../app/user/usecases/RegisterUser";
import { UserRepoSQL } from "../adapters/user/UserRepo.sql";
import { EmailSenderImpl } from "../adapters/user/EmailSender.impl";
import { IdGen } from "../shared/result";
import { signups } from "./events"; // Pub/Sub topic (next step)

export interface RegisterRequest { email: string; name?: string }
export interface RegisterResponse { id: string; email: string; name?: string; verified: boolean; status: HttpStatus }

export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/users" },
  async (req) => {
    const uc = new RegisterUser({ repo: UserRepoSQL(), id: IdGen, mail: EmailSenderImpl() });
    const user = await uc.exec(req);

    // emit an event for other subscribers
    await signups.publish({ userID: user.id, email: user.email });

    return { ...user, status: HttpStatus.Created };
  }
);
