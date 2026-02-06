import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// Default to libsql.db in the db package directory for consistent location
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDbPath = resolve(__dirname, "..", "libsql.db");

const client = createClient({
  url: process.env.DATABASE_URL || `file:${defaultDbPath}`,
});

export const db = drizzle({ client, schema });
