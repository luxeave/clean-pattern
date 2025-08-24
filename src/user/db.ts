import { SQLDatabase } from "encore.dev/storage/sqldb";

export const DB = new SQLDatabase("users", {
  migrations: "./migrations",
});
