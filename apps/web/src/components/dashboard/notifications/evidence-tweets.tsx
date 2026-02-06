"use client";

import { Suspense } from "react";
import { Tweet } from "react-tweet";

interface EvidenceTweetsProps {
  tweetIds: string[];
}

function TweetErrorBoundary({ tweetId, children }: { tweetId: string; children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch {
    return (
      <div className="border border-border bg-muted/50 p-3">
        <a
          href={`https://twitter.com/i/status/${tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground text-sm hover:text-foreground"
        >
          View tweet
        </a>
      </div>
    );
  }
}

export function EvidenceTweets({ tweetIds }: EvidenceTweetsProps) {
  if (!tweetIds || tweetIds.length === 0) {
    return null;
  }

  // Limit to max 3 tweets
  const displayTweets = tweetIds.slice(0, 3);

  return (
    <div className="mt-4 space-y-3">
      <h4 className="font-semibold text-sm">Evidence Tweets</h4>
      <div className="space-y-3">
        {displayTweets.map((tweetId) => (
          <TweetErrorBoundary key={tweetId} tweetId={tweetId}>
            <Suspense fallback={<div className="h-32 animate-pulse bg-muted" />}>
              <Tweet id={tweetId} />
            </Suspense>
          </TweetErrorBoundary>
        ))}
      </div>
    </div>
  );
}
