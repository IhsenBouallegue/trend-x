import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Documentation - TREND-X",
  description:
    "Learn how TREND-X monitors Twitter accounts using live, evolving profiles with AI-powered personality and topic analysis",
};

export default function DocsPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-10 p-4">
      {/* Header */}
      <div>
        <h1 className="font-bold text-2xl">How TREND-X Works</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Understanding live profile analysis, personality modeling, and change detection
        </p>
      </div>

      {/* Overview */}
      <div className="space-y-3 text-sm">
        <p>
          TREND-X maintains a live, evolving profile for each monitored Twitter account. As new
          tweets arrive, profiles update incrementally&mdash;topics shift, personality scores adjust,
          and activity patterns evolve in real time. When meaningful changes are
          detected&mdash;personality drift, new topics emerging, unusual silence&mdash;you get
          notified before it becomes obvious.
        </p>
        <p>
          No periodic snapshots. No batch comparisons. Continuous behavioral tracking that grows
          smarter with every tweet.
        </p>
      </div>

      {/* Documentation Sections */}
      <Accordion className="w-full">
        {/* System Overview */}
        <AccordionItem value="overview">
          <AccordionTrigger>System Overview</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                TREND-X is a single-user monitoring tool for Twitter accounts. Each account gets a
                persistent live profile that evolves continuously as new tweets are ingested. The
                profile tracks three dimensions: <span className="font-medium">topics</span> (what
                they talk about), <span className="font-medium">personality</span> (how they
                communicate), and <span className="font-medium">activity patterns</span> (when and
                how much they post).
              </p>
              <p>
                The system runs continuously with scheduled ingestion, classifying new tweets against
                existing topics, detecting behavioral shifts against rolling baselines, and alerting
                you to changes that matter.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Data Collection */}
        <AccordionItem value="data-collection">
          <AccordionTrigger>Data Collection</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                TREND-X fetches tweets using the{" "}
                <span className="font-medium">@steipete/bird</span> CLI integration, which supports
                lookback up to 1 year of tweet history.
              </p>
              <ul className="ml-4 list-disc space-y-2">
                <li>
                  Tweets are stored in a local <span className="font-medium">libSQL</span> database
                  for analysis
                </li>
                <li>
                  Scheduled ingestion runs periodically (configurable frequency) to capture new
                  activity
                </li>
                <li>
                  Quote tweets are enriched with the quoted content&mdash;commentary like
                  &ldquo;I agree 100%&rdquo; alone has no semantic signal, so the quoted text is
                  included for both topic classification and personality evaluation
                </li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Live Profile Analysis */}
        <AccordionItem value="profile-analysis">
          <AccordionTrigger>Live Profile Analysis</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 text-muted-foreground text-sm">
              <p>
                Each profile builds up incrementally through three interconnected analysis systems:
              </p>

              {/* Incremental Classification */}
              <div className="space-y-2">
                <p className="font-medium text-foreground">Incremental Topic Classification</p>
                <p>
                  New tweets are converted to vector embeddings and classified against the
                  account&apos;s existing topic centroids using{" "}
                  <span className="font-medium">cosine similarity</span> with a{" "}
                  <span className="font-medium">0.75 threshold</span>. Matched tweets update the
                  topic centroid incrementally (weighted averaging) and adjust topic proportions.
                </p>
                <p>
                  Unmatched tweets enter a <span className="font-medium">drift buffer</span>. When
                  enough unmatched tweets accumulate, re-clustering detects emerging new topics
                  automatically.
                </p>
              </div>

              {/* Topic Evolution */}
              <div className="space-y-2">
                <p className="font-medium text-foreground">Topic Evolution</p>
                <p>
                  Topics are not static. Centroids update continuously as new tweets are classified,
                  so topic definitions evolve naturally with the account&apos;s language. Topic
                  proportions reflect all-time weighted distributions across all classified tweets.
                </p>
              </div>

              {/* Personality Model */}
              <div className="space-y-2">
                <p className="font-medium text-foreground">Personality Model</p>
                <p>
                  Every <span className="font-medium">50 tweets</span>, the system evaluates the
                  account&apos;s personality across{" "}
                  <span className="font-medium">7 dimensions</span> scored 0&ndash;100:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    <span className="font-medium">Communication style:</span> formal, technical,
                    provocative
                  </li>
                  <li>
                    <span className="font-medium">Influence type:</span> thought leader, commentator,
                    curator, promoter
                  </li>
                </ul>
                <p>
                  In addition to numeric scores, the system extracts{" "}
                  <span className="font-medium">core values</span> as free-form tags (e.g.,
                  &ldquo;open source advocacy&rdquo;, &ldquo;decentralization&rdquo;). Personality
                  evaluation uses weighted recency sampling&mdash;all tweets are eligible, but recent
                  ones carry more weight.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Change Detection */}
        <AccordionItem value="change-detection">
          <AccordionTrigger>Change Detection</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                After each profile update, the system compares current values against stored
                baselines to detect meaningful behavioral shifts.
              </p>
              <p>
                <span className="font-medium">Four types of changes detected:</span>
              </p>
              <ul className="ml-4 list-disc space-y-2">
                <li>
                  <span className="font-medium">Personality drift:</span> Any personality dimension
                  shifts more than <span className="font-medium">15 points</span> from baseline
                </li>
                <li>
                  <span className="font-medium">Topic emergence:</span> A new topic exceeds{" "}
                  <span className="font-medium">15% share</span> of overall activity
                </li>
                <li>
                  <span className="font-medium">Topic abandonment:</span> An existing topic drops
                  more than <span className="font-medium">50%</span> or disappears entirely
                  (minimum 5% previous share required)
                </li>
                <li>
                  <span className="font-medium">Activity anomalies:</span> Tweet volume spikes or
                  drops exceed <span className="font-medium">2x baseline</span>, or silence exceeds
                  2x the previous maximum gap
                </li>
              </ul>
              <p>
                All thresholds use strict comparison (&gt;) with{" "}
                <span className="font-medium">24-hour repeat suppression</span> per change
                type and dimension to avoid notification spam.
              </p>
              <p>
                Each detected change includes an{" "}
                <span className="font-medium">AI-generated explanation</span> that describes the
                shift in plain language.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications">
          <AccordionTrigger>Notifications</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                Each detected change creates a notification with title, explanation, and supporting
                context.
              </p>
              <ul className="ml-4 list-disc space-y-2">
                <li>
                  Dashboard shows notification list sorted by recency with change details and
                  explanation
                </li>
                <li>
                  Optional <span className="font-medium">Telegram delivery</span> sends formatted
                  messages with account name and explanation
                </li>
                <li>Telegram uses exponential backoff with 3 retries for reliability</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Transparency */}
        <AccordionItem value="transparency">
          <AccordionTrigger>Transparency</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                TREND-X prioritizes transparency so you always know what the system is doing and why.
              </p>
              <ul className="ml-4 list-disc space-y-2">
                <li>
                  <span className="font-medium">Activity log:</span> Every profile update is
                  recorded&mdash;&ldquo;5 tweets classified&rdquo;, &ldquo;new topic
                  detected&rdquo;, &ldquo;personality evaluated&rdquo;
                </li>
                <li>
                  <span className="font-medium">Per-account view:</span> Each account shows its own
                  activity history with timestamps and details
                </li>
                <li>
                  <span className="font-medium">Global feed:</span> Cross-account activity stream on
                  the overview page for a full picture of system operations
                </li>
                <li>
                  <span className="font-medium">Live metrics:</span> Tweets processed, topics
                  active, last update time&mdash;all visible at a glance
                </li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
