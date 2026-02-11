export const queryKeys = {
  account: {
    all: [["account"]] as const,
    list: [["account", "list"]] as const,
    count: [["account", "count"]] as const,
  },
  config: {
    all: [["config"]] as const,
    getAll: [["config", "getAll"]] as const,
    isConfigured: [["config", "isConfigured"]] as const,
  },
  aiConfig: {
    all: [["aiConfig"]] as const,
    getConfig: [["aiConfig", "getConfig"]] as const,
    detectOllama: [["aiConfig", "detectOllama"]] as const,
    listModels: [["aiConfig", "listModels"]] as const,
    getUsageStats: [["aiConfig", "getUsageStats"]] as const,
  },
  notification: {
    all: [["notification"]] as const,
    getByAccount: (accountId: string) =>
      [["notification", "getByAccount"], { input: { accountId } }] as const,
    getUnreadCount: (accountId: string) =>
      [["notification", "getUnreadCount"], { input: { accountId } }] as const,
  },
  pipeline: {
    all: [["pipeline"]] as const,
    getRunHistory: (accountId: string) =>
      [["pipeline", "getRunHistory"], { input: { accountId } }] as const,
  },
  tweet: {
    all: [["tweet"]] as const,
  },
  overview: {
    all: [["overview"]] as const,
  },
  telegram: {
    all: [["telegram"]] as const,
    getStatus: [["telegram", "getStatus"]] as const,
  },
  schedule: {
    all: [["schedule"]] as const,
    list: [["schedule", "list"]] as const,
  },
  profile: {
    all: [["profile"]] as const,
    profile: (accountId: string) =>
      [["profile", "getProfile"], { input: { accountId } }] as const,
    activity: (accountId: string, limit?: number) =>
      [["profile", "getActivity"], { input: { accountId, limit } }] as const,
    globalActivity: (limit?: number) =>
      [["profile", "getGlobalActivity"], { input: { limit } }] as const,
    metrics: (accountId: string) =>
      [["profile", "getMetrics"], { input: { accountId } }] as const,
  },
  job: {
    all: [["job"]] as const,
    activeRuns: (accountId: string) =>
      [["job", "getActiveRuns"], { input: { accountId } }] as const,
    details: (jobId: string) =>
      [["job", "getDetails"], { input: { jobId } }] as const,
  },
  social: {
    all: [["social"]] as const,
    snapshotHistory: (accountId: string) =>
      [["social", "getSnapshotHistory"], { input: { accountId } }] as const,
    followerChart: (accountId: string, days?: number) =>
      [["social", "getFollowerChart"], { input: { accountId, days } }] as const,
    connections: (accountId: string, direction?: string) =>
      [["social", "getConnections"], { input: { accountId, direction } }] as const,
    recentChanges: (accountId: string) =>
      [["social", "getRecentChanges"], { input: { accountId } }] as const,
    graphData: (accountId?: string) =>
      [["social", "getGraphData"], { input: { accountId } }] as const,
    stats: (accountId: string) =>
      [["social", "getStats"], { input: { accountId } }] as const,
  },
} as const;
