// encore secret set --type local SendgridApiKey
// --type dev,preview,local,prod

import { secret } from "encore.dev/config";
import type { EmailSender } from "../../app/user/ports";

const SENDGRID_API_KEY = secret("SendgridApiKey"); // set value via CLI or dashboard

export const EmailSenderImpl = (): EmailSender => ({
  async sendWelcome(to, name) {
    // Example: call your ESP; here we just log for simplicity
    // fetch("https://api.sendgrid.com/v3/mail/send", { ...Authorization: `Bearer ${SENDGRID_API_KEY()}` ... })
    console.log("[EMAIL] Welcome", { to, name });
  }
});
