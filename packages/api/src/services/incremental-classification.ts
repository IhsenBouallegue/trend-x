import { db } from "@trend-x/db";
import { topicDriftBuffer, tweet as tweetTable } from "@trend-x/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  cosineSimilarity,
  clusterTweets,
  labelTopics,
  classifySentiment,
  type TweetWithEmbedding,
  type ClusterResult,
} from "./analysis";
import {
  getOrCreateProfile,
  updateProfile,
  type ProfileTopic,
} from "./profile";
import { logProfileActivity } from "./profile-activity";

// --- Configuration ---

/** Minimum cosine similarity to match a tweet to an existing topic */
const SIMILARITY_THRESHOLD = 0.75;

/** Number of unmatched tweets before triggering drift buffer re-clustering */
const DRIFT_BUFFER_LIMIT = 50;

// --- Types ---

export interface TweetForClassification {
  id: string;
  text: string;
  embedding: number[];
  tweetCreatedAt: number;
  /** Enriched text including quoted content for quote tweets */
  enrichedText?: string;
}

export interface ClassificationResult {
  matched: Array<{
    tweetId: string;
    topicId: string;
    topicLabel: string;
    similarity: number;
  }>;
  drifted: Array<{
    tweetId: string;
    bestSimilarity: number;
  }>;
  totalProcessed: number;
  newTopicsCreated: number;
}

// --- Core functions ---

/**
 * Classify tweets incrementally against a live account profile.
 *
 * For each tweet:
 * 1. Compute cosine similarity to all existing topic centroids
 * 2. If best match >= 0.75 threshold, assign to that topic and update centroid
 * 3. If no match, add to drift buffer
 * 4. If drift buffer exceeds 50 tweets, trigger re-clustering
 *
 * Updates profile topics and totalTweetsProcessed after classification.
 */
export async function classifyTweetsIncremental(
  accountId: string,
  tweets: TweetForClassification[],
): Promise<ClassificationResult> {
  if (tweets.length === 0) {
    return { matched: [], drifted: [], totalProcessed: 0, newTopicsCreated: 0 };
  }

  const profile = await getOrCreateProfile(accountId);
  const topics = [...profile.topics]; // mutable copy

  // First run: no existing topics, so cluster all tweets directly
  if (topics.length === 0) {
    return bootstrapTopics(accountId, profile.totalTweetsProcessed, tweets);
  }

  const matched: ClassificationResult["matched"] = [];
  const drifted: ClassificationResult["drifted"] = [];

  for (const tweet of tweets) {
    const embedding = tweet.embedding;

    // Find best matching topic
    let bestSimilarity = -1;
    let bestTopicIdx = -1;

    for (let i = 0; i < topics.length; i++) {
      const sim = cosineSimilarity(embedding, topics[i]!.centroid);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestTopicIdx = i;
      }
    }

    if (bestSimilarity >= SIMILARITY_THRESHOLD && bestTopicIdx >= 0) {
      // Match found - update topic centroid with weighted average
      const topic = topics[bestTopicIdx]!;
      const n = topic.tweetCount;
      const weight = 1 / (n + 1);

      // Weighted centroid update: new_centroid = (1 - weight) * old + weight * new
      const updatedCentroid = topic.centroid.map(
        (val, dim) => (1 - weight) * val + weight * embedding[dim]!,
      );

      topics[bestTopicIdx] = {
        ...topic,
        centroid: updatedCentroid,
        tweetCount: n + 1,
      };

      matched.push({
        tweetId: tweet.id,
        topicId: topic.id,
        topicLabel: topic.label,
        similarity: bestSimilarity,
      });
    } else {
      // No match - add to drift buffer
      await db.insert(topicDriftBuffer).values({
        accountId,
        tweetId: tweet.id,
        embedding: JSON.stringify(embedding),
      });

      drifted.push({
        tweetId: tweet.id,
        bestSimilarity: bestSimilarity > 0 ? bestSimilarity : 0,
      });
    }
  }

  // Recalculate proportions based on updated tweet counts
  const totalTweetCount = topics.reduce((sum, t) => sum + t.tweetCount, 0);
  if (totalTweetCount > 0) {
    for (const topic of topics) {
      topic.proportion = topic.tweetCount / totalTweetCount;
    }
  }

  // Update profile with new topic data and tweet count
  const newTotal = profile.totalTweetsProcessed + tweets.length;
  await updateProfile(accountId, {
    topics,
    totalTweetsProcessed: newTotal,
  });

  // Log classification activity
  await logProfileActivity(
    accountId,
    "tweets_classified",
    `Classified ${tweets.length} tweets: ${matched.length} matched, ${drifted.length} drifted`,
    {
      totalProcessed: tweets.length,
      matched: matched.length,
      drifted: drifted.length,
      topicBreakdown: matched.reduce(
        (acc, m) => {
          acc[m.topicLabel] = (acc[m.topicLabel] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
  );

  // Check if drift buffer needs processing
  let newTopicsCreated = 0;
  const bufferCount = await getDriftBufferCount(accountId);
  if (bufferCount >= DRIFT_BUFFER_LIMIT) {
    const driftResult = await processDriftBuffer(accountId);
    newTopicsCreated = driftResult.newTopics.length;
  }

  return {
    matched,
    drifted,
    totalProcessed: tweets.length,
    newTopicsCreated,
  };
}

/**
 * Process the drift buffer for an account when it exceeds the size threshold.
 *
 * 1. Load all buffered tweet embeddings
 * 2. Re-cluster using k-means (reuse clusterTweets from analysis.ts)
 * 3. Label new clusters via LLM (reuse labelTopics)
 * 4. Classify sentiment (reuse classifySentiment)
 * 5. Add new topics to profile
 * 6. Clear drift buffer
 *
 * Returns information about new topics created.
 */
export async function processDriftBuffer(accountId: string): Promise<{
  newTopics: Array<{ id: string; label: string; tweetCount: number }>;
  totalProcessed: number;
}> {
  // Load drift buffer entries
  const bufferEntries = await db
    .select()
    .from(topicDriftBuffer)
    .where(eq(topicDriftBuffer.accountId, accountId));

  if (bufferEntries.length === 0) {
    return { newTopics: [], totalProcessed: 0 };
  }

  // Convert to TweetWithEmbedding format for clustering
  const tweetsForClustering: TweetWithEmbedding[] = bufferEntries.map(
    (entry) => ({
      id: entry.tweetId,
      text: "", // Text not stored in buffer; clustering uses embeddings only
      embedding: JSON.parse(entry.embedding) as number[],
      tweetCreatedAt: entry.addedAt,
    }),
  );

  // Cluster the buffered tweets
  const clusters: ClusterResult[] = clusterTweets(tweetsForClustering);

  // Label each cluster via LLM
  // Note: labelTopics expects tweets with text. Since drift buffer doesn't store text,
  // we fetch tweet text for a few samples from each cluster for labeling.
  const clustersWithText = await enrichClustersWithText(clusters);
  const labels = await labelTopics(clustersWithText);

  // Classify sentiment
  const sentiments = await classifySentiment(clustersWithText);

  // Build new ProfileTopic entries
  const newTopics: Array<{ id: string; label: string; tweetCount: number }> =
    [];
  const profile = await getOrCreateProfile(accountId);
  const existingTopics = [...profile.topics];

  for (const cluster of clusters) {
    const label =
      labels.find((l) => l.clusterId === cluster.clusterId)?.label ||
      "Uncategorized";
    const sentiment = sentiments.find(
      (s) => s.clusterId === cluster.clusterId,
    ) || { positive: 0.33, neutral: 0.34, negative: 0.33 };

    const newTopic: ProfileTopic = {
      id: crypto.randomUUID(),
      label,
      centroid: cluster.centroid,
      proportion: 0, // Will be recalculated below
      tweetCount: cluster.tweetIds.length,
      sentiment: {
        positive: sentiment.positive,
        neutral: sentiment.neutral,
        negative: sentiment.negative,
      },
    };

    existingTopics.push(newTopic);
    newTopics.push({
      id: newTopic.id,
      label: newTopic.label,
      tweetCount: newTopic.tweetCount,
    });
  }

  // Recalculate proportions across all topics
  const totalTweetCount = existingTopics.reduce(
    (sum, t) => sum + t.tweetCount,
    0,
  );
  if (totalTweetCount > 0) {
    for (const topic of existingTopics) {
      topic.proportion = topic.tweetCount / totalTweetCount;
    }
  }

  // Update profile with merged topics
  await updateProfile(accountId, { topics: existingTopics });

  // Clear drift buffer for this account
  await db
    .delete(topicDriftBuffer)
    .where(eq(topicDriftBuffer.accountId, accountId));

  // Log activity
  await logProfileActivity(
    accountId,
    "drift_buffer_processed",
    `Processed drift buffer: ${bufferEntries.length} tweets yielded ${newTopics.length} new topics`,
    {
      bufferSize: bufferEntries.length,
      newTopicCount: newTopics.length,
      newTopicLabels: newTopics.map((t) => t.label),
    },
  );

  // Log each new topic individually
  for (const topic of newTopics) {
    await logProfileActivity(
      accountId,
      "new_topic_detected",
      `New topic detected: "${topic.label}" (${topic.tweetCount} tweets)`,
      { topicId: topic.id, label: topic.label, tweetCount: topic.tweetCount },
    );
  }

  return {
    newTopics,
    totalProcessed: bufferEntries.length,
  };
}

/**
 * Bootstrap topics on the first run by clustering all tweets at once.
 * Since there are no existing topics, incremental matching would send
 * everything to the drift buffer. Instead, cluster directly.
 */
async function bootstrapTopics(
  accountId: string,
  previousTweetsProcessed: number,
  tweets: TweetForClassification[],
): Promise<ClassificationResult> {
  const tweetsForClustering: TweetWithEmbedding[] = tweets.map((t) => ({
    id: t.id,
    text: t.enrichedText || t.text,
    embedding: t.embedding,
    tweetCreatedAt: t.tweetCreatedAt,
  }));

  const clusters = clusterTweets(tweetsForClustering);
  const labels = await labelTopics(clusters);
  const sentiments = await classifySentiment(clusters);

  const totalTweetCount = tweets.length;
  const newTopics: ProfileTopic[] = [];

  for (const cluster of clusters) {
    const label =
      labels.find((l) => l.clusterId === cluster.clusterId)?.label ||
      "Uncategorized";
    const sentiment = sentiments.find(
      (s) => s.clusterId === cluster.clusterId,
    ) || { positive: 0.33, neutral: 0.34, negative: 0.33 };

    newTopics.push({
      id: crypto.randomUUID(),
      label,
      centroid: cluster.centroid,
      proportion: cluster.tweetIds.length / totalTweetCount,
      tweetCount: cluster.tweetIds.length,
      sentiment: {
        positive: sentiment.positive,
        neutral: sentiment.neutral,
        negative: sentiment.negative,
      },
    });
  }

  // Build matched result — every tweet belongs to a cluster
  const matched: ClassificationResult["matched"] = [];
  for (const cluster of clusters) {
    const topic = newTopics.find(
      (t) => t.label === (labels.find((l) => l.clusterId === cluster.clusterId)?.label || "Uncategorized"),
    );
    if (!topic) continue;
    for (const tweetId of cluster.tweetIds) {
      matched.push({
        tweetId,
        topicId: topic.id,
        topicLabel: topic.label,
        similarity: 1,
      });
    }
  }

  const newTotal = previousTweetsProcessed + tweets.length;
  await updateProfile(accountId, {
    topics: newTopics,
    totalTweetsProcessed: newTotal,
  });

  await logProfileActivity(
    accountId,
    "topics_bootstrapped",
    `Initial clustering: ${tweets.length} tweets into ${newTopics.length} topics`,
    {
      totalProcessed: tweets.length,
      topicCount: newTopics.length,
      topicLabels: newTopics.map((t) => t.label),
    },
  );

  return {
    matched,
    drifted: [],
    totalProcessed: tweets.length,
    newTopicsCreated: newTopics.length,
  };
}

// --- Helpers ---

/**
 * Get the current drift buffer count for an account.
 */
async function getDriftBufferCount(accountId: string): Promise<number> {
  const rows = await db
    .select({ id: topicDriftBuffer.id })
    .from(topicDriftBuffer)
    .where(eq(topicDriftBuffer.accountId, accountId));
  return rows.length;
}

/**
 * Enrich cluster results with actual tweet text from the database.
 * labelTopics and classifySentiment need tweet text for LLM prompts.
 * Since drift buffer only stores embeddings, we fetch text from tweet table.
 */
async function enrichClustersWithText(
  clusters: ClusterResult[],
): Promise<ClusterResult[]> {
  // Collect all tweet IDs
  const allTweetIds = clusters.flatMap((c) => c.tweetIds);

  if (allTweetIds.length === 0) return clusters;

  // Batch fetch tweet text from tweet table
  const tweetRows = await db
    .select({ id: tweetTable.id, text: tweetTable.text })
    .from(tweetTable)
    .where(inArray(tweetTable.id, allTweetIds));

  const textMap = new Map(tweetRows.map((r) => [r.id, r.text]));

  // Build enriched clusters with text filled in
  return clusters.map((cluster) => ({
    ...cluster,
    tweets: cluster.tweets.map((t) => ({
      ...t,
      text: textMap.get(t.id) || t.text || "[text unavailable]",
    })),
  }));
}
