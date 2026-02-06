import { TwitterClient } from "@steipete/bird";
import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const handle = process.argv[2];
  if (!handle) {
    console.error("Usage: bun run apps/server/src/debug-fetch-tweets.ts <twitter_handle>");
    process.exit(1);
  }

  // Get credentials from config
  const [authTokenRow] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_auth_token"));

  const [ct0Row] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, "twitter_ct0"));

  if (!authTokenRow?.value || !ct0Row?.value) {
    console.error("Missing Twitter credentials in config table");
    process.exit(1);
  }

  console.log(`Fetching tweets for @${handle}...`);

  const client = new TwitterClient({
    cookies: {
      authToken: authTokenRow?.value,
      ct0: ct0Row?.value,
    },
  });

  const searchResult = await client.search("from:steipete", 50);
  console.log(searchResult.tweets?.length);
  const userId = await client.getUserIdByUsername("elonmusk");
  console.log(userId);
  const userTweets = await client.getUserTweetsPaged(userId.userId ?? "", 100);
  console.log(userTweets.tweets?.[0]);
}

main().catch(console.error);
