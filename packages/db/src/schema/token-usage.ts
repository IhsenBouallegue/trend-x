import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tokenUsage = sqliteTable("token_usage", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  operation: text("operation").notNull(), // "embedding" | "labeling" | "sentiment" | "explanation"
  provider: text("provider").notNull(), // "openai" | "openrouter" | "ollama"
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
