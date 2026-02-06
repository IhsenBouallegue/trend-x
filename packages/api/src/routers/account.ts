import { db } from "@trend-x/db";
import { account } from "@trend-x/db/schema";
import { TRPCError } from "@trpc/server";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

export const accountRouter = router({
  list: publicProcedure.query(async () => {
    const accounts = await db
      .select({
        id: account.id,
        handle: account.handle,
        createdAt: account.createdAt,
      })
      .from(account)
      .orderBy(desc(account.createdAt));

    return accounts;
  }),

  create: publicProcedure
    .input(
      z.object({
        handle: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // Clean handle: trim whitespace and remove @ if present
      const cleanHandle = input.handle.trim().replace(/^@/, "");

      if (!cleanHandle) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Handle cannot be empty",
        });
      }

      const [created] = await db.insert(account).values({ handle: cleanHandle }).returning();

      return created;
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      // Check if this is the last account
      const [result] = await db.select({ count: count() }).from(account);
      const accountCount = result?.count ?? 0;

      if (accountCount <= 1) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete the last account",
        });
      }

      await db.delete(account).where(eq(account.id, input.id));

      return { success: true };
    }),

  count: publicProcedure.query(async () => {
    const [result] = await db.select({ count: count() }).from(account);
    return result?.count ?? 0;
  }),
});
