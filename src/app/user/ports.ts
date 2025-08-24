export interface UserRepo {
  create(u: { id: string; email: string; name?: string; verified: boolean }): Promise<void>;
  findByEmail(email: string): Promise<{ id: string; email: string; name?: string; verified: boolean } | null>;
  disableUnverifiedOlderThan(hours: number): Promise<number>;
}

export interface IdGen { newId(): string }

export interface EmailSender {
  sendWelcome(to: string, name?: string): Promise<void>;
}
