import { Topic, Subscription } from "encore.dev/pubsub";
import { EmailSenderImpl } from "../adapters/user/EmailSender.impl";

export interface SignupEvent { userID: string; email: string }

export const signups = new Topic<SignupEvent>("user-signups", {
  deliveryGuarantee: "at-least-once",
});

// Send a "secondary" welcome email (or kick off onboarding) on signup:
const _ = new Subscription(signups, "send-welcome-secondary", {
  handler: async (evt) => {
    await EmailSenderImpl().sendWelcome(evt.email);
  },
});
