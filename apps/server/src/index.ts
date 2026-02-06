import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@trend-x/api/context";
import { appRouter } from "@trend-x/api/routers/index";
import { initializeScheduler } from "@trend-x/api/services/scheduler";
import { env } from "@trend-x/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// Initialize tweet fetch scheduler - runs every 6 hours
initializeScheduler();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default {
  port: Number(process.env.PORT) || 4000,
  fetch: app.fetch,
};
