# trend-x

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup



Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the web application.
The API is running at [http://localhost:4000](http://localhost:4000).

## Running with Docker

Build and run the app in a single container (server on port 4000, web on port 3000). **Port forwarding** maps host ports to the container so you can open the app in your browser:

- `-p 3000:3000` — host port 3000 → container port 3000 (Next.js web app)
- `-p 4000:4000` — host port 4000 → container port 4000 (Hono/tRPC server)

**Full commands:**

```bash
# Build the image (default: NEXT_PUBLIC_SERVER_URL=http://localhost:4000)
docker build -t trend-x .
docker run -p 3000:3000 -p 4000:4000 trend-x
```

Then open [http://localhost:3000](http://localhost:3000) for the web app and [http://localhost:4000](http://localhost:4000) for the API.

To use a different server URL at build time (e.g. for production):

```bash
docker build --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com -t trend-x .
docker run -p 3000:3000 -p 4000:4000 trend-x
```

## Git Hooks and Formatting

- Format and lint fix: `bun run check`

## Project Structure

```
trend-x/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Hono, TRPC)
├── packages/
│   ├── api/         # API layer / business logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:studio`: Open database studio UI
- `bun run db:local`: Start the local SQLite database
- `bun run check`: Run Biome formatting and linting
