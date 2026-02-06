import { db } from "@trend-x/db";
import { config, tweet } from "@trend-x/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getProvider } from "./ai/provider-factory";
import { trackTokenUsage } from "./ai/token-tracker";
import { calculateTemporalWeight } from "./analysis";
import { logProfileActivity } from "./profile-activity";
import {
  getOrCreateProfile,
  updateProfile,
  type Personality,
  type PersonalityScores,
} from "./profile";

// --- Constants ---

/** Number of new tweets required before re-evaluating personality */
const PERSONALITY_EVAL_THRESHOLD = 5;

/** Maximum tweets to fetch for personality evaluation */
const MAX_TWEETS_FOR_EVAL = 200;

/** Maximum tweets to include in the LLM prompt (sampled with recency weighting) */
const MAX_PROMPT_TWEETS = 60;

// --- Zod schema for LLM response validation ---

const personalityResponseSchema = z.object({
  scores: z.object({
    formal: z.number().min(0).max(100),
    technical: z.number().min(0).max(100),
    provocative: z.number().min(0).max(100),
    thoughtLeader: z.number().min(0).max(100),
    commentator: z.number().min(0).max(100),
    curator: z.number().min(0).max(100),
    promoter: z.number().min(0).max(100),
  }),
  values: z.array(z.string()).max(5),
  summary: z.string(),
});

// --- Helper functions ---

/**
 * Read a configured model name from the config table.
 */
async function getConfiguredModel(
  key: string,
  defaultModel: string,
): Promise<string> {
  const [result] = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, key));
  return result?.value || defaultModel;
}

/**
 * Extract quoted tweet text from rawJson for semantic enrichment.
 * Returns the quoted tweet's text, or null if not a quote tweet or no quoted content.
 */
function extractQuotedText(rawJson: string | null): string | null {
  if (!rawJson) return null;
  try {
    const json = JSON.parse(rawJson) as Record<string, unknown>;
    // Bird CLI format: quoted_status object with text field
    const quotedStatus = json.quoted_status as
      | Record<string, unknown>
      | undefined;
    if (quotedStatus?.text) {
      return quotedStatus.text as string;
    }
    // Alternative format: quotedTweet
    const quotedTweet = json.quotedTweet as
      | Record<string, unknown>
      | undefined;
    if (quotedTweet?.text) {
      return quotedTweet.text as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sample tweets with weighted recency: all tweets are included but recent ones
 * are more likely to be selected when we need to subsample.
 *
 * Uses weighted reservoir sampling: each tweet gets a weight based on temporal
 * decay, then we select the top-weighted tweets up to maxCount.
 */
function sampleWithRecencyWeighting<
  T extends { tweetCreatedAt: number; weight?: number },
>(tweets: T[], maxCount: number, referenceTimestamp: number): T[] {
  if (tweets.length <= maxCount) return tweets;

  // Assign weights and sort by weight descending
  const weighted = tweets.map((t) => ({
    tweet: t,
    weight: calculateTemporalWeight(t.tweetCreatedAt, referenceTimestamp),
  }));

  weighted.sort((a, b) => b.weight - a.weight);

  return weighted.slice(0, maxCount).map((w) => w.tweet);
}

/**
 * Format a tweet for the personality prompt.
 * Enriches quote tweets with the quoted content for better semantic signal.
 */
function formatTweetForPrompt(
  text: string,
  isQuoteTweet: boolean,
  quotedText: string | null,
): string {
  if (isQuoteTweet && quotedText) {
    return `${text}\n  [Quoting: "${quotedText}"]`;
  }
  return text;
}

// --- Exported functions ---

/**
 * Determine whether personality should be re-evaluated based on tweet count
 * since last evaluation.
 *
 * @param totalTweetsProcessed - Current total tweets processed for this profile
 * @param lastPersonalityEvalAt - Timestamp of last personality eval (null = never evaluated)
 * @param tweetCountAtLastEval - Tweet count when last evaluated (derived from profile state)
 * @returns true if enough new tweets have been processed to warrant re-evaluation
 */
export function shouldReEvaluatePersonality(
  totalTweetsProcessed: number,
  lastPersonalityEvalAt: number | null,
): boolean {
  // Never evaluated: always evaluate on first run
  if (lastPersonalityEvalAt === null) {
    return totalTweetsProcessed > 0;
  }

  // Already evaluated: we always re-evaluate every THRESHOLD tweets
  // Since we update totalTweetsProcessed on each classification batch,
  // we check if current count crosses a threshold boundary
  return totalTweetsProcessed % PERSONALITY_EVAL_THRESHOLD === 0;
}

/**
 * Evaluate personality for an account using LLM analysis of their tweets.
 *
 * Process:
 * 1. Fetch recent tweets for the account
 * 2. Sample with recency weighting (all tweets considered, recent weighted more heavily)
 * 3. Enrich quote tweets with quoted content
 * 4. Send to LLM with structured JSON output instructions
 * 5. Parse and validate response with Zod
 * 6. Update profile with new personality (set baseline on first evaluation)
 * 7. Track token usage and log activity
 *
 * @param accountId - The account to evaluate
 * @returns The evaluated Personality object
 */
export async function evaluatePersonality(
  accountId: string,
): Promise<Personality> {
  const provider = await getProvider();
  const model = await getConfiguredModel("ai_chat_model", "gpt-4o-mini");

  // 1. Fetch recent tweets (most recent first)
  const tweets = await db
    .select({
      id: tweet.id,
      text: tweet.text,
      tweetCreatedAt: tweet.tweetCreatedAt,
      isQuoteTweet: tweet.isQuoteTweet,
      rawJson: tweet.rawJson,
    })
    .from(tweet)
    .where(eq(tweet.accountId, accountId))
    .orderBy(desc(tweet.tweetCreatedAt))
    .limit(MAX_TWEETS_FOR_EVAL);

  if (tweets.length === 0) {
    throw new Error(
      `No tweets found for account ${accountId}. Cannot evaluate personality.`,
    );
  }

  // 2. Sample with recency weighting
  const now = Math.floor(Date.now() / 1000);
  const sampled = sampleWithRecencyWeighting(tweets, MAX_PROMPT_TWEETS, now);

  // 3. Format tweets for the prompt, enriching quote tweets
  const formattedTweets = sampled.map((t, i) => {
    const quotedText =
      t.isQuoteTweet === 1 ? extractQuotedText(t.rawJson) : null;
    const formatted = formatTweetForPrompt(
      t.text,
      t.isQuoteTweet === 1,
      quotedText,
    );
    return `${i + 1}. ${formatted}`;
  });

  const tweetsBlock = formattedTweets.join("\n\n");

  // 4. Call LLM with structured JSON output instructions
  const systemPrompt = `You are a personality analyst. Given a collection of tweets from a single account, evaluate their online personality across fixed dimensions.

Return a JSON object with this exact structure:
{
  "scores": {
    "formal": <0-100>,
    "technical": <0-100>,
    "provocative": <0-100>,
    "thoughtLeader": <0-100>,
    "commentator": <0-100>,
    "curator": <0-100>,
    "promoter": <0-100>
  },
  "values": ["value1", "value2", ...],
  "summary": "1-2 sentence personality summary"
}

Dimension definitions:
- formal: How formal/professional vs casual/colloquial is the writing style (100=very formal)
- technical: How technical/specialized vs general-audience the content is (100=highly technical)
- provocative: How provocative/contrarian vs measured/diplomatic the tone is (100=very provocative)
- thoughtLeader: How much original insight/analysis vs reporting others' work (100=pure original thought)
- commentator: How much they react to/comment on events vs share original content (100=pure commentator)
- curator: How much they share/recommend others' content vs create their own (100=pure curator)
- promoter: How much they promote products/projects/themselves (100=constant self-promotion)

For "values": Extract up to 5 short tags (2-4 words each) representing values/principles this person holds. Be concise. Examples: "open-source advocacy", "privacy maximalism", "startup hustle", "decentralization", "data-driven investing".

For "summary": Write 1-2 sentences capturing this person's online personality and communication style. Be specific and evidence-based.

IMPORTANT: Return ONLY the JSON object, no markdown fences, no explanations.`;

  const userPrompt = `Analyze these ${sampled.length} tweets from a single account (recent tweets weighted more heavily in selection):\n\n${tweetsBlock}`;

  const response = await provider.chat(model, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // 5. Track token usage
  await trackTokenUsage({
    operation: "personality",
    provider: provider.name,
    model,
    promptTokens: response.promptTokens,
    completionTokens: response.completionTokens,
    totalTokens: response.totalTokens,
  });

  // 6. Parse and validate response
  const personality = parsePersonalityResponse(response.content);

  // 7. Update profile
  const profile = await getOrCreateProfile(accountId);
  const isFirstEvaluation = profile.personality === null;

  const profileUpdates: {
    personality: Personality;
    personalityBaseline?: Personality;
    lastPersonalityEvalAt: number;
  } = {
    personality,
    lastPersonalityEvalAt: now,
  };

  // Set baseline on first evaluation
  if (isFirstEvaluation) {
    profileUpdates.personalityBaseline = personality;
  }

  await updateProfile(accountId, profileUpdates);

  // 8. Log activity
  await logProfileActivity(
    accountId,
    "personality_evaluated",
    isFirstEvaluation
      ? `Initial personality baseline established from ${sampled.length} tweets`
      : `Personality re-evaluated from ${sampled.length} tweets`,
    {
      tweetsAnalyzed: sampled.length,
      isBaseline: isFirstEvaluation,
      scores: personality.scores,
      tokensUsed: response.totalTokens,
    },
  );

  return personality;
}

/**
 * Parse and validate the LLM personality response.
 * Handles common LLM output quirks (markdown fences, extra whitespace).
 */
function parsePersonalityResponse(content: string): Personality {
  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse personality LLM response as JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  const result = personalityResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Personality LLM response failed validation: ${result.error.message}`,
    );
  }

  return {
    scores: result.data.scores as PersonalityScores,
    values: result.data.values,
    summary: result.data.summary,
  };
}
