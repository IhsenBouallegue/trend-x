import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { kmeans } from "ml-kmeans";
import { getProvider } from "./ai/provider-factory";
import { trackTokenUsage } from "./ai/token-tracker";

/**
 * Strip URLs from tweet text so embeddings and labels focus on semantic content.
 * Returns the remaining text trimmed, or empty string if nothing is left.
 */
export function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/g, "").trim();
}

// Exponential decay with 90-day half-life
const HALF_LIFE_DAYS = 90;
const HALF_LIFE_SECONDS = HALF_LIFE_DAYS * 24 * 60 * 60;
const DECAY_CONSTANT = Math.LN2 / HALF_LIFE_SECONDS;

// Reply tweets weighted at 50% of standalone/retweet
const REPLY_WEIGHT_MULTIPLIER = 0.5;

// Adaptive window settings
const MIN_TWEETS_FOR_FINGERPRINT = 20;
const INITIAL_WINDOW_DAYS = 90;
const EXPANSION_STEPS = [180, 365, 730]; // 6mo, 1yr, 2yr

/**
 * Helper function to read a configured model from config table.
 */
async function getConfiguredModel(key: string, defaultModel: string): Promise<string> {
  const [result] = await db.select({ value: config.value }).from(config).where(eq(config.key, key));
  return result?.value || defaultModel;
}

export interface TweetWithEmbedding {
  id: string;
  text: string;
  embedding: number[];
  tweetCreatedAt: number;
}

export interface ClusterResult {
  clusterId: number;
  tweetIds: string[];
  tweets: TweetWithEmbedding[];
  centroid: number[];
  proportion: number;
}

/**
 * Calculate exponential decay weight based on tweet age.
 * Recent tweets have weight ~1.0, 90-day-old tweets ~0.5, 180-day ~0.25.
 */
export function calculateTemporalWeight(
  tweetTimestamp: number,
  referenceTimestamp: number,
): number {
  const ageSeconds = Math.max(0, referenceTimestamp - tweetTimestamp);
  return Math.exp(-DECAY_CONSTANT * ageSeconds);
}

/**
 * Calculate combined weight for a tweet (temporal * type multiplier).
 * @param tweetTimestamp - Unix timestamp of tweet
 * @param referenceTimestamp - Current time or most recent tweet time
 * @param isReply - Whether tweet is a reply
 */
export function calculateTweetWeight(
  tweetTimestamp: number,
  referenceTimestamp: number,
  isReply: boolean,
): number {
  const temporal = calculateTemporalWeight(tweetTimestamp, referenceTimestamp);
  const typeMultiplier = isReply ? REPLY_WEIGHT_MULTIPLIER : 1.0;
  return temporal * typeMultiplier;
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Cluster tweets using k-means.
 * Dynamically determines k based on tweet count (sqrt heuristic, min 2, max 15).
 */
export function clusterTweets(tweets: TweetWithEmbedding[]): ClusterResult[] {
  if (tweets.length < 2) {
    // Single tweet = single cluster
    return [
      {
        clusterId: 0,
        tweetIds: tweets.map((t) => t.id),
        tweets,
        centroid: tweets[0]?.embedding || [],
        proportion: 1,
      },
    ];
  }

  // Dynamic k: sqrt of tweet count, bounded
  const k = Math.max(2, Math.min(15, Math.round(Math.sqrt(tweets.length))));

  const embeddings = tweets.map((t) => t.embedding);
  const result = kmeans(embeddings, k, { initialization: "kmeans++" });

  // Group tweets by cluster
  const clusters = new Map<number, TweetWithEmbedding[]>();
  for (let i = 0; i < tweets.length; i++) {
    const clusterId = result.clusters[i]!;
    if (!clusters.has(clusterId)) clusters.set(clusterId, []);
    clusters.get(clusterId)!.push(tweets[i]!);
  }

  // Build result array
  const clusterResults: ClusterResult[] = [];
  for (const [clusterId, clusterTweets] of clusters) {
    clusterResults.push({
      clusterId,
      tweetIds: clusterTweets.map((t) => t.id),
      tweets: clusterTweets,
      centroid: result.centroids[clusterId]!,
      proportion: clusterTweets.length / tweets.length,
    });
  }

  // Sort by proportion descending
  return clusterResults.sort((a, b) => b.proportion - a.proportion);
}

export interface TweetWithEmbeddingAndType extends TweetWithEmbedding {
  isReply: boolean;
  weight?: number; // Pre-calculated weight
}

/**
 * Calculate adaptive time window based on tweet density.
 * Starts at 90 days, expands to 180 days, 1 year, 2 years if needed.
 * Returns the window in seconds that provides at least MIN_TWEETS_FOR_FINGERPRINT tweets.
 *
 * @param tweets - All available tweets with timestamps
 * @param referenceTimestamp - Current time or fingerprint generation time
 * @returns Object with { windowSeconds, tweetCount, expanded }
 */
export function getAdaptiveTimeWindow(
  tweets: Array<{ tweetCreatedAt: number }>,
  referenceTimestamp?: number,
): { windowSeconds: number; tweetCount: number; expanded: boolean } {
  const refTime = referenceTimestamp ?? Math.floor(Date.now() / 1000);
  const initialWindow = INITIAL_WINDOW_DAYS * 24 * 60 * 60;

  // Count tweets in initial window
  let currentWindow = initialWindow;
  let tweetsInWindow = tweets.filter((t) => refTime - t.tweetCreatedAt <= currentWindow).length;

  // If we have enough tweets, return initial window
  if (tweetsInWindow >= MIN_TWEETS_FOR_FINGERPRINT) {
    return {
      windowSeconds: currentWindow,
      tweetCount: tweetsInWindow,
      expanded: false,
    };
  }

  // Otherwise, expand through steps until we hit minimum or run out of steps
  for (const expansionDays of EXPANSION_STEPS) {
    currentWindow = expansionDays * 24 * 60 * 60;
    tweetsInWindow = tweets.filter((t) => refTime - t.tweetCreatedAt <= currentWindow).length;

    if (tweetsInWindow >= MIN_TWEETS_FOR_FINGERPRINT) {
      return {
        windowSeconds: currentWindow,
        tweetCount: tweetsInWindow,
        expanded: true,
      };
    }
  }

  // If still not enough, use all available tweets (maximum expansion)
  return {
    windowSeconds: currentWindow,
    tweetCount: tweets.length,
    expanded: true,
  };
}

/**
 * Calculate weighted average centroid from tweets.
 */
function calculateWeightedCentroid(tweets: TweetWithEmbeddingAndType[]): number[] {
  if (tweets.length === 0) return [];

  const dim = tweets[0]!.embedding.length;
  const centroid = new Array<number>(dim).fill(0);
  let totalWeight = 0;

  for (const tweet of tweets) {
    const w = tweet.weight || 1;
    totalWeight += w;
    for (let i = 0; i < dim; i++) {
      centroid[i]! += tweet.embedding[i]! * w;
    }
  }

  // Normalize by total weight
  for (let i = 0; i < dim; i++) {
    centroid[i]! /= totalWeight;
  }

  return centroid;
}

/**
 * Cluster tweets using k-means with temporal and type weighting.
 * Weights affect centroid calculation - higher weight tweets pull centroid more.
 *
 * Algorithm:
 * 1. Calculate weight for each tweet
 * 2. Run k-means to get initial cluster assignments
 * 3. Recalculate centroids using weighted average of embeddings
 */
export function clusterTweetsWeighted(
  tweets: TweetWithEmbeddingAndType[],
  referenceTimestamp?: number,
): ClusterResult[] {
  if (tweets.length < 2) {
    // Single tweet = single cluster
    return [
      {
        clusterId: 0,
        tweetIds: tweets.map((t) => t.id),
        tweets: tweets,
        centroid: tweets[0]?.embedding || [],
        proportion: 1,
      },
    ];
  }

  const refTime = referenceTimestamp ?? Math.floor(Date.now() / 1000);

  // Calculate weights for all tweets
  const tweetsWithWeights = tweets.map((t) => ({
    ...t,
    weight: calculateTweetWeight(t.tweetCreatedAt, refTime, t.isReply),
  }));

  // Dynamic k: sqrt of tweet count, bounded 2-15
  const k = Math.max(2, Math.min(15, Math.round(Math.sqrt(tweets.length))));

  // Run standard k-means for cluster assignment
  const embeddings = tweets.map((t) => t.embedding);
  const result = kmeans(embeddings, k, { initialization: "kmeans++" });

  // Group tweets by cluster
  const clusters = new Map<number, TweetWithEmbeddingAndType[]>();
  for (let i = 0; i < tweetsWithWeights.length; i++) {
    const clusterId = result.clusters[i]!;
    if (!clusters.has(clusterId)) clusters.set(clusterId, []);
    clusters.get(clusterId)!.push(tweetsWithWeights[i]!);
  }

  // Build result with weighted centroids
  const clusterResults: ClusterResult[] = [];
  const totalWeight = tweetsWithWeights.reduce((sum, t) => sum + (t.weight || 1), 0);

  for (const [clusterId, clusterTweets] of clusters) {
    // Calculate weighted centroid
    const weightedCentroid = calculateWeightedCentroid(clusterTweets);

    // Calculate weighted proportion (sum of weights in cluster / total weights)
    const clusterWeight = clusterTweets.reduce((sum, t) => sum + (t.weight || 1), 0);

    clusterResults.push({
      clusterId,
      tweetIds: clusterTweets.map((t) => t.id),
      tweets: clusterTweets,
      centroid: weightedCentroid,
      proportion: clusterWeight / totalWeight,
    });
  }

  // Sort by proportion descending
  return clusterResults.sort((a, b) => b.proportion - a.proportion);
}

export interface TopicLabel {
  clusterId: number;
  label: string;
}

/**
 * Generate human-readable labels for clusters via configured chat model.
 * Sends sample tweets from each cluster for labeling.
 */
export async function labelTopics(clusters: ClusterResult[]): Promise<TopicLabel[]> {
  const provider = await getProvider();
  const model = await getConfiguredModel("ai_chat_model", "gpt-4o-mini");
  const labels: TopicLabel[] = [];

  for (const cluster of clusters) {
    // Take up to 5 sample tweets
    const samples = cluster.tweets.slice(0, 5).map((t) => t.text);
    const samplesText = samples.map((s, i) => `${i + 1}. ${s}`).join("\n");

    const response = await provider.chat(
      model,
      [
        {
          role: "system",
          content:
            "You are a topic labeling assistant. Given sample tweets from a cluster, generate a concise, specific label (1-5 words) that describes the main theme. Be specific rather than generic. Return ONLY the label, no explanation.",
        },
        {
          role: "user",
          content: `Label this cluster of tweets:\n\n${samplesText}`,
        },
      ],
    );

    // Track token usage
    await trackTokenUsage({
      operation: "labeling",
      provider: provider.name,
      model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.totalTokens,
    });

    labels.push({
      clusterId: cluster.clusterId,
      label: response.content.trim() || "Uncategorized",
    });
  }

  return labels;
}

export interface SentimentResult {
  clusterId: number;
  positive: number;
  neutral: number;
  negative: number;
}

/**
 * Classify sentiment for tweets in each cluster via configured chat model.
 * Returns proportions (0-1) for positive/neutral/negative per cluster.
 */
export async function classifySentiment(clusters: ClusterResult[]): Promise<SentimentResult[]> {
  const provider = await getProvider();
  const model = await getConfiguredModel("ai_chat_model", "gpt-4o-mini");
  const results: SentimentResult[] = [];

  for (const cluster of clusters) {
    // Batch classify all tweets in cluster
    const tweetsText = cluster.tweets.map((t) => t.text);

    // For efficiency, send up to 20 tweets per request
    const BATCH = 20;
    let positive = 0,
      neutral = 0,
      negative = 0;

    for (let i = 0; i < tweetsText.length; i += BATCH) {
      const batch = tweetsText.slice(i, i + BATCH);
      const numbered = batch.map((t, j) => `${j + 1}. ${t}`).join("\n");

      const response = await provider.chat(
        model,
        [
          {
            role: "system",
            content:
              "You are a sentiment classifier. For each numbered tweet, respond with ONLY a single letter: P (positive), N (neutral), or X (negative). One letter per line, in order. No explanations.",
          },
          {
            role: "user",
            content: numbered,
          },
        ],
      );

      // Track token usage
      await trackTokenUsage({
        operation: "sentiment",
        provider: provider.name,
        model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
      });

      const lines = response.content
        .trim()
        .split("\n")
        .map((l) => l.trim().toUpperCase());

      for (const line of lines) {
        if (line.startsWith("P")) positive++;
        else if (line.startsWith("X")) negative++;
        else neutral++; // N or unknown = neutral
      }
    }

    const total = cluster.tweets.length || 1;
    results.push({
      clusterId: cluster.clusterId,
      positive: positive / total,
      neutral: neutral / total,
      negative: negative / total,
    });
  }

  return results;
}

export interface ActivityMetrics {
  tweetsPerDay: number;
  maxSilenceHours: number;
  windowStart: number;
  windowEnd: number;
}

/**
 * Calculate activity metrics for 30-day rolling window.
 * @param tweets - Tweets sorted by tweetCreatedAt descending (most recent first)
 */
export function calculateActivityMetrics(tweets: TweetWithEmbedding[]): ActivityMetrics {
  if (tweets.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    return {
      tweetsPerDay: 0,
      maxSilenceHours: 0,
      windowStart: now - 30 * 24 * 60 * 60,
      windowEnd: now,
    };
  }

  // 30-day window from most recent tweet
  const windowEnd = tweets[0]!.tweetCreatedAt;
  const windowStart = windowEnd - 30 * 24 * 60 * 60;

  // Filter to window
  const inWindow = tweets.filter(
    (t) => t.tweetCreatedAt >= windowStart && t.tweetCreatedAt <= windowEnd,
  );

  // Tweets per day
  const daySpan = 30;
  const tweetsPerDay = inWindow.length / daySpan;

  // Max silence: find largest gap between consecutive tweets
  let maxSilenceSeconds = 0;
  const sorted = [...inWindow].sort((a, b) => a.tweetCreatedAt - b.tweetCreatedAt);

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.tweetCreatedAt - sorted[i - 1]!.tweetCreatedAt;
    if (gap > maxSilenceSeconds) maxSilenceSeconds = gap;
  }

  return {
    tweetsPerDay: Math.round(tweetsPerDay * 100) / 100,
    maxSilenceHours: Math.round((maxSilenceSeconds / 3600) * 10) / 10,
    windowStart,
    windowEnd,
  };
}

/**
 * Select representative sample tweets for a cluster.
 * Picks tweets closest to centroid.
 */
export function selectSampleTweets(cluster: ClusterResult, count = 5): string[] {
  if (cluster.tweets.length <= count) {
    return cluster.tweetIds;
  }

  // Calculate distance to centroid for each tweet
  const withDistance = cluster.tweets.map((t) => ({
    id: t.id,
    distance: euclideanDistance(t.embedding, cluster.centroid),
  }));

  // Sort by distance and take closest
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, count).map((w) => w.id);
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
