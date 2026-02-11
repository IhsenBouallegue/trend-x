import { TwitterClient } from "@steipete/bird";
import { db } from "@trend-x/db";
import { config } from "@trend-x/db/schema";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const SNAPSHOTS_DIR = join(import.meta.dir, "../data/investor-snapshots");
const KNOWN_PAGE_THRESHOLD = 3; // stop after N consecutive all-known pages

interface UserSnapshot {
  id: string;
  username: string;
  name: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
  isBlueVerified?: boolean;
  firstSeenFollowing?: string; // ISO timestamp — when we first saw investor follow this user
  firstSeenFollower?: string; // ISO timestamp — when we first saw this user follow investor
}

// Persistent index: tracks when each user ID was first observed
interface FirstSeenIndex {
  following: Record<string, string>; // userId -> ISO timestamp
  followers: Record<string, string>;
}

interface Snapshot {
  investor: string;
  timestamp: string;
  following: UserSnapshot[];
  followers: UserSnapshot[];
  mutual: string[];
  followingOnly: string[];
  followersOnly: string[];
}

async function getClient() {
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

  return new TwitterClient({
    cookies: {
      authToken: authTokenRow.value,
      ct0: ct0Row.value,
    },
  });
}

type FetchFn = (
  userId: string,
  count?: number,
  cursor?: string,
) => Promise<{
  success: boolean;
  users?: {
    id: string;
    username: string;
    name: string;
    description?: string;
    followersCount?: number;
    followingCount?: number;
    isBlueVerified?: boolean;
  }[];
  error?: string;
  nextCursor?: string;
}>;

function toSnapshot(u: {
  id: string;
  username: string;
  name: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
  isBlueVerified?: boolean;
}): UserSnapshot {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    description: u.description,
    followersCount: u.followersCount,
    followingCount: u.followingCount,
    isBlueVerified: u.isBlueVerified,
  };
}

interface FetchResult {
  users: UserSnapshot[];
  stoppedEarly: boolean;
}

async function fetchAllPaged(
  fetchFn: FetchFn,
  userId: string,
  label: string,
  knownIds?: Set<string>,
): Promise<FetchResult> {
  const allUsers: UserSnapshot[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  let page = 0;
  let consecutiveKnownPages = 0;
  let stoppedEarly = false;

  while (true) {
    page++;
    console.log(
      `  Fetching ${label} page ${page}${cursor ? ` (cursor: ${cursor.slice(0, 20)}...)` : ""}...`,
    );

    const result = await fetchFn(userId, 100, cursor);

    if (!result.success) {
      console.error(`  Error fetching ${label}: ${result.error}`);
      break;
    }

    if (!result.users || result.users.length === 0) {
      break;
    }

    let newOnPage = 0;
    for (const u of result.users) {
      if (seenIds.has(u.id)) continue;
      seenIds.add(u.id);
      allUsers.push(toSnapshot(u));
      if (knownIds && !knownIds.has(u.id)) newOnPage++;
    }

    if (knownIds) {
      if (newOnPage === 0) {
        consecutiveKnownPages++;
        console.log(
          `  Got ${result.users.length} users (all known) [${consecutiveKnownPages}/${KNOWN_PAGE_THRESHOLD}]`,
        );
        if (consecutiveKnownPages >= KNOWN_PAGE_THRESHOLD) {
          console.log(`  Stopping early — ${KNOWN_PAGE_THRESHOLD} consecutive pages of known users`);
          stoppedEarly = true;
          break;
        }
      } else {
        consecutiveKnownPages = 0;
        console.log(
          `  Got ${result.users.length} users (${newOnPage} new, total: ${allUsers.length})`,
        );
      }
    } else {
      console.log(`  Got ${result.users.length} users (total: ${allUsers.length})`);
    }

    if (!result.nextCursor || result.nextCursor.startsWith("0|")) break;
    cursor = result.nextCursor;

    await new Promise((r) => setTimeout(r, 1500));
  }

  return { users: allUsers, stoppedEarly };
}

function mergeWithPrevious(
  fetched: UserSnapshot[],
  previous: UserSnapshot[],
  stoppedEarly: boolean,
): UserSnapshot[] {
  if (!stoppedEarly) return fetched;

  // Merge: use freshly fetched data for users we saw, carry over the rest from previous
  const fetchedIds = new Set(fetched.map((u) => u.id));
  const carried = previous.filter((u) => !fetchedIds.has(u.id));
  console.log(
    `  Merged: ${fetched.length} fetched + ${carried.length} carried from previous = ${fetched.length + carried.length} total`,
  );
  return [...fetched, ...carried];
}

function analyzeConnections(following: UserSnapshot[], followers: UserSnapshot[]) {
  const followingIds = new Set(following.map((u) => u.id));
  const followerIds = new Set(followers.map((u) => u.id));

  const mutual = [...followingIds].filter((id) => followerIds.has(id));
  const followingOnly = [...followingIds].filter((id) => !followerIds.has(id));
  const followersOnly = [...followerIds].filter((id) => !followingIds.has(id));

  return { mutual, followingOnly, followersOnly };
}

function loadPreviousSnapshot(handle: string): Snapshot | null {
  const dir = join(SNAPSHOTS_DIR, handle);
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f: string) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const latest = join(dir, files[0]);
  console.log(`Found previous snapshot: ${files[0]}`);
  return JSON.parse(readFileSync(latest, "utf-8"));
}

function saveSnapshot(handle: string, snapshot: Snapshot) {
  const dir = join(SNAPSHOTS_DIR, handle);
  mkdirSync(dir, { recursive: true });

  const filename = `${snapshot.timestamp.replace(/[:.]/g, "-")}.json`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved: ${filepath}`);
}

function loadFirstSeenIndex(handle: string): FirstSeenIndex {
  const filepath = join(SNAPSHOTS_DIR, handle, "_first-seen.json");
  if (!existsSync(filepath)) return { following: {}, followers: {} };
  return JSON.parse(readFileSync(filepath, "utf-8"));
}

function updateFirstSeenIndex(
  handle: string,
  following: UserSnapshot[],
  followers: UserSnapshot[],
  now: string,
): FirstSeenIndex {
  const index = loadFirstSeenIndex(handle);

  for (const u of following) {
    if (!index.following[u.id]) {
      index.following[u.id] = now;
    }
    u.firstSeenFollowing = index.following[u.id];
  }

  for (const u of followers) {
    if (!index.followers[u.id]) {
      index.followers[u.id] = now;
    }
    u.firstSeenFollower = index.followers[u.id];
  }

  const dir = join(SNAPSHOTS_DIR, handle);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "_first-seen.json"), JSON.stringify(index, null, 2));

  return index;
}

function diffList(prev: UserSnapshot[], curr: UserSnapshot[]) {
  const prevIds = new Set(prev.map((u) => u.id));
  const currIds = new Set(curr.map((u) => u.id));
  return {
    added: curr.filter((u) => !prevIds.has(u.id)),
    removed: prev.filter((u) => !currIds.has(u.id)),
  };
}

function userById(snapshot: Snapshot, id: string): UserSnapshot | undefined {
  return (
    snapshot.following.find((u) => u.id === id) ?? snapshot.followers.find((u) => u.id === id)
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "?";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function printUser(u: UserSnapshot, prefix: string) {
  console.log(`${prefix}@${u.username} (${u.name})`);
  const firstSeen = u.firstSeenFollowing ?? u.firstSeenFollower;
  console.log(
    `${prefix}  ${u.followersCount?.toLocaleString() ?? "?"} followers | ${u.isBlueVerified ? "Verified" : "Not verified"} | First seen: ${formatDate(firstSeen)}`,
  );
  if (u.description) {
    console.log(`${prefix}  Bio: ${u.description.slice(0, 120)}`);
  }
}

async function main() {
  const handle = process.argv[2];
  const fullFetch = process.argv.includes("--full");

  if (!handle) {
    console.error("Usage: bun run apps/server/src/debug-fetch-tweets.ts <twitter_handle> [--full]");
    console.error("");
    console.error("Tracks an investor's bidirectional connection web over time.");
    console.error("Captures both following + followers, analyzes mutual connections,");
    console.error("and diffs snapshots to surface emerging founders.");
    console.error("");
    console.error("Options:");
    console.error("  --full  Force a complete fetch (skip smart early-stop)");
    process.exit(1);
  }

  const client = await getClient();

  console.log(`\nResolving @${handle}...`);
  const lookup = await client.getUserIdByUsername(handle);
  if (!lookup.userId) {
    console.error(`Could not find user @${handle}`);
    process.exit(1);
  }
  console.log(`User ID: ${lookup.userId}`);

  // Load previous snapshot for smart fetching
  const previous = loadPreviousSnapshot(handle);
  const prevFollowingIds =
    !fullFetch && previous ? new Set(previous.following.map((u) => u.id)) : undefined;
  const prevFollowerIds =
    !fullFetch && previous ? new Set(previous.followers.map((u) => u.id)) : undefined;

  if (previous && !fullFetch) {
    console.log("Smart fetch enabled — will stop early when hitting known users");
  } else if (previous && fullFetch) {
    console.log("Full fetch forced via --full flag");
  }

  // Fetch both directions
  console.log(`\n[1/2] Fetching who @${handle} follows...`);
  const followingResult = await fetchAllPaged(
    client.getFollowing.bind(client),
    lookup.userId,
    "following",
    prevFollowingIds,
  );
  const following = mergeWithPrevious(
    followingResult.users,
    previous?.following ?? [],
    followingResult.stoppedEarly,
  );
  console.log(`Total following: ${following.length}`);

  console.log(`\n[2/2] Fetching who follows @${handle}...`);
  const followersResult = await fetchAllPaged(
    client.getFollowers.bind(client),
    lookup.userId,
    "followers",
    prevFollowerIds,
  );
  const followers = mergeWithPrevious(
    followersResult.users,
    previous?.followers ?? [],
    followersResult.stoppedEarly,
  );
  console.log(`Total followers: ${followers.length}`);

  // Track first-seen timestamps (mutates users in-place to add firstSeen* fields)
  const now = new Date().toISOString();
  updateFirstSeenIndex(handle, following, followers, now);

  // Analyze bidirectional connections
  const { mutual, followingOnly, followersOnly } = analyzeConnections(following, followers);

  const snapshot: Snapshot = {
    investor: handle,
    timestamp: now,
    following,
    followers,
    mutual,
    followingOnly,
    followersOnly,
  };

  // Print connection summary
  console.log(`\n=== Connection Web for @${handle} ===`);
  console.log(`Following:      ${following.length}`);
  console.log(`Followers:      ${followers.length}`);
  console.log(`Mutual:         ${mutual.length} (both follow each other)`);
  console.log(`Following only: ${followingOnly.length} (investor follows, no follow-back)`);
  console.log(`Followers only: ${followersOnly.length} (they follow investor, not followed back)`);

  if (previous) {
    const followingDiff = diffList(previous.following, snapshot.following);
    const followersDiff = diffList(previous.followers, snapshot.followers);
    const elapsed = Math.round(
      (new Date(snapshot.timestamp).getTime() - new Date(previous.timestamp).getTime()) /
        (1000 * 60 * 60),
    );

    console.log(`\n--- Changes since last snapshot (${elapsed}h ago) ---`);

    if (followingResult.stoppedEarly || followersResult.stoppedEarly) {
      console.log("(smart fetch — unfollow detection may be incomplete, use --full for accuracy)");
    }

    if (followingDiff.added.length > 0) {
      console.log(
        `\n NEW FOLLOWING (${followingDiff.added.length}) — investor started following:`,
      );
      for (const u of followingDiff.added) {
        const isMutual = snapshot.followers.some((f) => f.id === u.id);
        printUser(u, "  + ");
        if (isMutual) console.log("    ^ MUTUAL — this person also follows the investor");
        console.log("");
      }
    }

    if (followingDiff.removed.length > 0) {
      console.log(`\n UNFOLLOWED (${followingDiff.removed.length}) — investor stopped following:`);
      for (const u of followingDiff.removed) {
        console.log(`  - @${u.username} (${u.name})`);
      }
    }

    if (followersDiff.added.length > 0) {
      console.log(
        `\n NEW FOLLOWERS (${followersDiff.added.length}) — started following the investor:`,
      );
      for (const u of followersDiff.added) {
        const isMutual = snapshot.following.some((f) => f.id === u.id);
        printUser(u, "  + ");
        if (isMutual) console.log("    ^ MUTUAL — investor also follows this person");
        console.log("");
      }
    }

    if (followersDiff.removed.length > 0) {
      console.log(
        `\n LOST FOLLOWERS (${followersDiff.removed.length}) — stopped following the investor:`,
      );
      for (const u of followersDiff.removed) {
        console.log(`  - @${u.username} (${u.name})`);
      }
    }

    const prevMutualSet = new Set(previous.mutual ?? []);
    const newMutuals = mutual.filter((id) => !prevMutualSet.has(id));
    if (newMutuals.length > 0) {
      console.log(
        `\n NEW MUTUAL CONNECTIONS (${newMutuals.length}) — strongest signal for emerging founders:`,
      );
      for (const id of newMutuals) {
        const u = userById(snapshot, id);
        if (u) {
          printUser(u, "  <-> ");
          console.log("");
        }
      }
    }
  } else {
    console.log("\nFirst snapshot — no previous data to compare.");
    console.log("Run again later to detect connection changes.\n");

    if (mutual.length > 0) {
      const mutualUsers = mutual
        .map((id) => userById(snapshot, id))
        .filter((u): u is UserSnapshot => !!u)
        .sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));

      console.log("Top 10 mutual connections (by follower count):");
      for (const u of mutualUsers.slice(0, 10)) {
        console.log(
          `  <-> @${u.username} — ${u.followersCount?.toLocaleString() ?? "?"} followers — ${u.name}`,
        );
      }
    }
  }

  console.log("");
  saveSnapshot(handle, snapshot);
}

main().catch(console.error);
