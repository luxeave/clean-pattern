// Secrets via environment variables (use a .env file for local dev)
import type { EmailSender } from "../../app/user/ports";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

export const EmailSenderImpl = (): EmailSender => ({
  async sendWelcome(to, name) {
    // Example: call your ESP; here we just log for simplicity
    // fetch("https://api.sendgrid.com/v3/mail/send", { headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } /* ... */ })
    console.log("[EMAIL] Welcome", { to, name });
  }
});
