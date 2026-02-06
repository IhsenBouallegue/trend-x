import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const config = sqliteTable("config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
