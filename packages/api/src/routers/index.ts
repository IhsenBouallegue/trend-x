import { publicProcedure, router } from "../index";
import { accountRouter } from "./account";
import { aiConfigRouter } from "./ai-config";
import { configRouter } from "./config";
import { ingestRouter } from "./ingest";
import { jobRouter } from "./job";
import { notificationRouter } from "./notification";
import { overviewRouter } from "./overview";
import { profileRouter } from "./profile";
import { scheduleRouter } from "./schedule";
import { telegramRouter } from "./telegram";
import { tweetRouter } from "./tweet";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  account: accountRouter,
  aiConfig: aiConfigRouter,
  config: configRouter,
  ingest: ingestRouter,
  job: jobRouter,
  notification: notificationRouter,
  overview: overviewRouter,
  profile: profileRouter,
  schedule: scheduleRouter,
  telegram: telegramRouter,
  tweet: tweetRouter,
});
export type AppRouter = typeof appRouter;
