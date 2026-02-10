# mono-repos

A pnpm + Turborepo monorepo with two Vite React apps sharing a common UI package built on shadcn/ui + Tailwind CSS v4.

## Project Structure

```
mono-repos/
├── apps/
│   ├── dashboard/          # Main app — Vite + React (TypeScript)
│   └── auth/               # Login/Signup — Vite + React (JavaScript)
├── packages/
│   ├── ui/                 # Shared shadcn/ui components
│   └── typescript-config/  # Shared tsconfig presets
├── turbo.json              # Turborepo task config
├── pnpm-workspace.yaml     # Workspace member declarations
├── vercel.json             # Vercel deployment config
└── .npmrc                  # pnpm settings (type hoisting)
```

## Prerequisites

- **Node.js** >= 18
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)

## Getting Started

```bash
# Install all dependencies
pnpm install

# Start both apps in dev mode
pnpm dev
```

| App       | Local URL                         |
|-----------|-----------------------------------|
| Dashboard | http://localhost:5173              |
| Auth      | http://localhost:5174/auth/        |
| Auth (via proxy) | http://localhost:5173/auth  |

The dashboard's Vite config includes a dev proxy that forwards `/auth` requests to the auth dev server, so you can access both apps from a single origin during development.

## Scripts

```bash
# Development
pnpm dev                         # Start all apps
pnpm --filter @workspace/dashboard dev   # Start only dashboard
pnpm --filter @workspace/auth dev        # Start only auth

# Build
pnpm build                       # Build all apps (production)

# Add shadcn/ui components
pnpm ui:add button               # Add a component to packages/ui
pnpm ui:add card input badge     # Add multiple at once

# Manage dependencies
pnpm --filter @workspace/ui add <pkg>          # Add to ui package
pnpm --filter @workspace/dashboard add -D <pkg> # Add dev dep to dashboard
```

## How It Works

### Shared UI Package (Source Exports)

The UI package exports raw `.tsx` source files — no build step required. When an app imports a component:

```tsx
import { Button } from "@workspace/ui/components/button"
```

1. pnpm resolves `@workspace/ui` via workspace symlink
2. The package's `exports` field maps `components/button` → `src/components/button.tsx`
3. Vite/esbuild transpiles the `.tsx` on-the-fly (strips types, transforms JSX)

This means the JS app (auth) can consume TypeScript components without having TypeScript installed — esbuild handles the conversion inside Vite's pipeline.

### Tailwind CSS v4 in a Monorepo

Each app's `src/index.css` follows this pattern:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@workspace/ui/styles/globals.css";

@source "../../../packages/ui/src";
```

- `@import "tailwindcss"` lives in each app (not the UI package) because Tailwind is an app-level dependency
- `@import "@workspace/ui/styles/globals.css"` pulls in the shared theme (oklch colors, CSS variables, dark mode)
- `@source` tells Tailwind v4 to scan the UI package for class names — without it, component styles won't be generated

### Dev Proxy

During development, each app runs on its own port. The dashboard's `vite.config.ts` includes a proxy so `/auth` requests are forwarded to the auth dev server:

```ts
server: {
  proxy: {
    "/auth": {
      target: "http://localhost:5174",
      changeOrigin: true,
    },
  },
}
```

A small Vite plugin (`authRedirect`) rewrites `/auth` → `/auth/` to match the auth app's `base: "/auth/"` setting.

## Deployment (Vercel)

Both apps are deployed as a single Vercel project using path-based routing:

| Route     | App       |
|-----------|-----------|
| `/`       | Dashboard |
| `/auth`   | Auth      |

### How it works

`vercel.json` configures:

1. **Build**: `pnpm build && cp -r apps/auth/dist apps/dashboard/dist/auth` — builds both apps, then copies auth's output into dashboard's `dist/auth/` directory
2. **Output**: `apps/dashboard/dist` is served as the single output directory
3. **Rewrites**: SPA fallback rules route `/auth/*` to `/auth/index.html` and everything else to `/index.html`

### Testing production build locally

```bash
pnpm build
cp -r apps/auth/dist apps/dashboard/dist/auth
npx serve apps/dashboard/dist
```

Then visit `http://localhost:3000` (dashboard) and `http://localhost:3000/auth` (auth).

## Tech Stack

| Tool | Purpose |
|------|---------|
| [pnpm](https://pnpm.io) | Package manager with strict isolation and workspace support |
| [Turborepo](https://turbo.build) | Monorepo build orchestration with caching |
| [Vite](https://vite.dev) | Dev server and production bundler |
| [React 19](https://react.dev) | UI framework |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first CSS with CSS-first configuration |
| [shadcn/ui](https://ui.shadcn.com) | Copy-paste component primitives (Radix UI + Tailwind) |

## Deep Dive

See [SETUP.md](SETUP.md) for an in-depth explanation of every config file, design decision, and gotcha encountered during setup.
