# Use Debian (glibc) base so @libsql/client resolves linux-x64-gnu; Alpine (musl) needs linux-x64-musl which can fail in Docker.
FROM oven/bun:1-debian AS base
WORKDIR /app

# Build-time: URL the browser will use to reach the tRPC server (inlined into Next.js at build)
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:4000
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

# Copy workspace manifests and config
COPY package.json bun.lock turbo.json tsconfig.json biome.json bts.jsonc ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Build server and web (Turbo builds in dependency order)
RUN bun run build

# Ensure start script is executable and has Unix line endings
RUN chmod +x scripts/start.sh && sed -i 's/\r$//' scripts/start.sh 2>/dev/null || true

EXPOSE 3000 4000

CMD ["./scripts/start.sh"]
