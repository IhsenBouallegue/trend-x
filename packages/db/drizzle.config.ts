import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "turso",
  dbCredentials: {
    url: "file:libsql.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
