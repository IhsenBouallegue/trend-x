#!/usr/bin/env sh
set -e

# Push DB schema (creates sqlite file + tables on first run)
cd /app/packages/db && bunx drizzle-kit push --force

# Start server in background (port 4000). NODE_PATH so bundled server resolves @libsql/linux-x64-gnu from root node_modules.
cd /app/apps/server && NODE_PATH=/app/node_modules bun run start &

# Start web in foreground so the container stays up (port 3000)
cd /app/apps/web && bun run start
