# Monorepo Setup Guide

A pnpm + Turborepo monorepo with two Vite React apps (TypeScript & JavaScript) sharing a common UI package built on shadcn/ui + Tailwind CSS v4.

---

## Table of Contents

1. [Why a Monorepo?](#why-a-monorepo)
2. [Tool Choices — Why Each One](#tool-choices--why-each-one)
3. [Root Configuration](#1-root-configuration)
4. [Shared TypeScript Config](#2-shared-typescript-config)
5. [Shared UI Package](#3-shared-ui-package)
6. [Shared Firebase Package](#3b-shared-firebase-package-packagesfirebase)
7. [Dashboard App (TypeScript)](#4-dashboard-app)
8. [Auth App (JavaScript)](#5-auth-app)
9. [Install & Add Components](#6-install--add-components)
10. [How Everything Connects](#how-everything-connects)
11. [Gotchas & Lessons Learned](#gotchas--lessons-learned)
12. [Mental Models](#mental-models-for-monorepo-thinking)
13. [Vercel Deployment](#vercel-deployment)
14. [Dev Proxy](#dev-proxy-accessing-both-apps-on-one-port)
15. [Testing Production Build Locally](#testing-production-build-locally)
16. [Common Commands](#common-commands)

---

## Why a Monorepo?

**What**: A monorepo keeps multiple projects (apps, packages, libraries) in a single git repository.

**Why**: Without a monorepo, sharing a Button component between two apps means:
- Publishing it to npm (or a private registry)
- Versioning it separately
- Waiting for publish + install cycles every time you change a color

With a monorepo, you edit the Button, save, and both apps hot-reload instantly. One PR can update the component and both consuming apps together — no version drift, no publish step.

**How**: We use pnpm workspaces to link packages locally and Turborepo to orchestrate tasks across them.

---

## Tool Choices — Why Each One

### pnpm (not npm or yarn)

**What**: A package manager that uses a content-addressable store and symlinks.

**Why**:
- **Strict isolation**: If package A doesn't declare a dependency on package B, it can't accidentally import it. npm/yarn hoist everything, letting you use undeclared dependencies (phantom dependencies) that break in production.
- **Disk efficiency**: pnpm stores one copy of each package version globally. Projects link to it. If 5 projects use React 19, it's stored once on disk.
- **`workspace:*` protocol**: When you write `"@workspace/ui": "workspace:*"` in a `package.json`, pnpm creates a symlink to the local package instead of fetching from npm. The `*` means "any version — just use what's local."

**How it works under the hood**:
```
apps/dashboard/node_modules/@workspace/ui
  → symlink → ../../packages/ui
```
So `import { Button } from "@workspace/ui/components/button"` actually reads `packages/ui/src/components/button.tsx` (via the `exports` field).

### Turborepo (not Nx, not Lerna)

**What**: A build orchestrator that understands the dependency graph between your workspaces.

**Why**:
- **Dependency-aware**: When you run `pnpm build`, Turborepo knows dashboard depends on ui, so it builds ui first. You don't manage ordering manually.
- **Caching**: If you run `pnpm build` twice and nothing changed, the second run is instant — Turborepo replays cached output.
- **Parallel execution**: Independent tasks (dashboard build and auth build) run in parallel automatically.

**How** `"^build"` works:
```
"build": { "dependsOn": ["^build"] }
```
The `^` prefix means "run this task in my dependencies first." So if dashboard depends on ui, Turborepo runs `ui:build` → then `dashboard:build`. Without `^`, it would only mean "run my own build task first" (useless).

### Vite (not Webpack, not Parcel)

**What**: A dev server and build tool powered by esbuild (dev) and Rollup (production).

**Why**:
- **Native ESM dev server**: Vite doesn't bundle during development. It serves files as ES modules. Your browser requests `button.tsx`, Vite transpiles it on-demand and sends it. This means startup is instant regardless of project size.
- **esbuild transpilation**: TypeScript/JSX is transpiled by esbuild (written in Go), which is 10-100x faster than Babel/tsc.
- **HMR**: When you edit a file, only that module is replaced in the browser — no full page reload.

**Key insight for this monorepo**: Vite treats workspace-linked packages as source code, not pre-built node_modules. When auth imports `@workspace/ui/components/button`, Vite sees it's a symlink to a `.tsx` file and transpiles it through esbuild. This is why we don't need a build step for the UI package.

### shadcn/ui (not a component library)

**What**: A CLI that copies component source code into your project. It's NOT a dependency you install.

**Why**:
- **Full ownership**: The component code lives in YOUR repo. You can modify anything — no fighting with library APIs or theme overrides.
- **No version lock-in**: Since it's your code, there's no "upgrade shadcn to v3" migration. You update individual components when you want.
- **Tailwind-native**: Components use Tailwind classes directly, so they work naturally with the Tailwind v4 theme system.

**How**: When you run `pnpm ui:add button`, the CLI:
1. Reads `packages/ui/components.json` for config
2. Downloads the Button component source from the shadcn registry
3. Writes it to `packages/ui/src/components/button.tsx`
4. Rewrites imports to use your aliases (`@workspace/ui/lib/utils`)
5. Installs any missing dependencies (`@radix-ui/react-slot`)

### Tailwind CSS v4 (not v3)

**What**: A utility-first CSS framework. v4 is the CSS-first rewrite — configuration lives in CSS, not `tailwind.config.js`.

**Why v4 over v3**:
- **No JavaScript config**: Theme is defined in CSS using `@theme`. One less config file.
- **CSS-native**: Uses standard CSS features (`@layer`, `@custom-variant`, CSS variables) instead of JavaScript plugin APIs.
- **oklch colors**: Better perceptual uniformity — `oklch(0.5 0.2 27)` looks "equally bright" as `oklch(0.5 0.2 150)`. HSL doesn't guarantee this.

---

## Architecture Overview

```
vite-react-mono-repo/
├── apps/
│   ├── dashboard/              # Dashboard — Vite React (TypeScript)
│   │   └── src/
│   │       ├── App.tsx         # Auth guard + layout composition
│   │       ├── components/     # Navbar, StatsCards, TeamMembers, etc.
│   │       └── data/           # Static data + types
│   └── auth/                   # Auth — Vite React (JavaScript)
│       └── src/
│           ├── App.jsx         # Auth guard + view toggle
│           ├── components/     # Navbar, LoginForm, SignupForm
│           └── lib/            # Firebase error mapping
├── packages/
│   ├── ui/                     # Shared shadcn/ui components
│   ├── firebase/               # Shared Firebase auth (config, context, hooks)
│   └── typescript-config/      # Shared tsconfig presets
├── package.json                # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
├── .npmrc
└── .gitignore
```

### The `apps/` vs `packages/` Convention

This isn't enforced by any tool — it's a widely-adopted convention:
- **`apps/`**: Deployable applications (they produce a `dist/` with HTML/JS/CSS)
- **`packages/`**: Shared libraries consumed by apps (they export code, not build artifacts)

The distinction matters because apps have `dev`/`build` scripts while packages may have neither (like our UI package, which exports source directly).

---

## Step-by-Step Setup

### 1. Root Configuration

#### `package.json`

```json
{
  "name": "vite-react-mono-repo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "ui:add": "pnpm dlx shadcn@latest add --cwd packages/ui"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@9.15.4"
}
```

Line-by-line:
- **`"private": true`** — Prevents accidentally publishing the root package to npm. Always set this for monorepo roots and internal packages.
- **`"turbo dev"`** — Turborepo finds every workspace with a `dev` script and runs them all. It reads `turbo.json` to know that `dev` is persistent and shouldn't be cached.
- **`"pnpm dlx shadcn@latest add --cwd packages/ui"`** — `pnpm dlx` is like `npx`: it downloads and runs a package without installing it globally. `--cwd packages/ui` changes the working directory so the shadcn CLI finds `packages/ui/components.json`.
- **`"packageManager": "pnpm@9.15.4"`** — Corepack (built into Node.js) reads this field and ensures everyone on the team uses exactly this pnpm version. Run `corepack enable` to activate it.

#### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**What**: Declares which directories are workspace members.

**Why it's a separate file**: pnpm requires this file specifically (npm uses `workspaces` in package.json, yarn uses the same). pnpm's workspace protocol only recognizes packages declared here.

**How glob patterns work**: `"apps/*"` means every direct subdirectory of `apps/` that contains a `package.json`. It does NOT recurse — `apps/foo/bar/` would not be included unless you wrote `"apps/**"`.

#### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

**`"dependsOn": ["^build"]`** — The `^` is called the "topological dependency" operator. Without it:
- `["build"]` means "run MY build first, then run it again" (infinite loop, doesn't make sense)

With `^`:
- `["^build"]` means "run `build` in every package I depend on first"
- Example: dashboard depends on @workspace/ui → Turborepo runs ui's build before dashboard's build

**`"outputs": ["dist/**"]`** — Tells Turborepo which files are produced by the build. Used for caching: if inputs haven't changed, Turborepo restores `dist/` from cache instead of rebuilding.

**`"persistent": true`** — Marks `dev` as a long-running process (the Vite dev server). Without this, Turborepo would wait for it to "finish" before running other tasks.

**`"cache": false`** — Dev servers should never be cached. Every `pnpm dev` should start fresh.

**Why `tasks` not `pipeline`**: Turborepo v1 used `"pipeline"`. v2 renamed it to `"tasks"`. Using `"pipeline"` in v2 triggers a deprecation warning and will break in future versions.

#### `.npmrc`

```
auto-install-peers=true
public-hoist-pattern[]=@types/*
```

**`auto-install-peers=true`**

**What**: When you install a package that declares `peerDependencies`, pnpm auto-installs them.

**Why**: Without this, pnpm prints warnings like "react is a peer dependency of @radix-ui/react-slot, you need to install it yourself." Since the apps already have React, auto-install-peers resolves peer deps from the workspace automatically.

**`public-hoist-pattern[]=@types/*`**

**What**: Hoists all `@types/*` packages to the root `node_modules/` so they're accessible from any workspace.

**Why this is needed**: TypeScript resolves type declarations by walking up the `node_modules` tree from the file's physical location. In our setup:

1. dashboard's `tsconfig.app.json` has `paths` pointing to `../../packages/ui/src/*`
2. When tsc processes `packages/ui/src/components/button.tsx`, it sees `import * as React from "react"`
3. tsc looks for `@types/react` starting from `packages/ui/src/components/` and walking up
4. Without hoisting, `@types/react` only exists in `apps/dashboard/node_modules/` and `packages/ui/node_modules/` (pnpm's `.pnpm` store) — tsc can't find it via the node_modules walk
5. With hoisting, `@types/react` exists at `<root>/node_modules/@types/react` — tsc finds it

**The `[]=` syntax**: This is pnpm's way of appending to an array config. Each `[]=` adds an entry. You can have multiple:
```
public-hoist-pattern[]=@types/*
public-hoist-pattern[]=@prisma/client
```

#### `.gitignore`

```
node_modules
dist
.turbo
*.local
.DS_Store
```

- **`node_modules`** — Never commit dependencies. They're reproducible from `pnpm-lock.yaml`.
- **`dist`** — Build output. Reproducible from source.
- **`.turbo`** — Turborepo's local cache directory. Contains hashes and cached build output.
- **`*.local`** — Vite convention for local env files (`.env.local`) that contain secrets.
- **`.DS_Store`** — macOS Finder metadata files. Useless in git.

---

### 2. Shared TypeScript Config (`packages/typescript-config`)

**What**: A workspace that contains only tsconfig JSON files — no code.

**Why**: Without this, every workspace would duplicate the same 10+ compiler options. When you want to change `target` from `ES2020` to `ES2022`, you'd edit 3 files. With shared configs, you edit one.

**How `extends` works with workspace packages**: When `tsconfig.app.json` says:
```json
{ "extends": "@workspace/typescript-config/vite.json" }
```
TypeScript resolves `@workspace/typescript-config` through `node_modules` (where pnpm created a symlink), then finds `vite.json` in that package's root directory.

#### `package.json`

```json
{
  "name": "@workspace/typescript-config",
  "version": "0.0.0",
  "private": true
}
```

- **No `main`, no `exports`, no `dependencies`**: This package only provides JSON files. TypeScript's `extends` reads them directly — no module resolution needed.
- **`version: "0.0.0"`**: Convention for internal packages that will never be published. Semantically means "not versioned."

#### `base.json` — The Foundation

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  }
}
```

Each option explained:

- **`target: "ES2020"`** — What JavaScript version to emit. ES2020 supports optional chaining (`?.`), nullish coalescing (`??`), and `BigInt`. All modern browsers and Node 14+ support it. Don't set this to `ESNext` — it moves with each TypeScript release and can break production.

- **`module: "ESNext"`** — What module system to use in output. `ESNext` means native `import`/`export`. This is correct because Vite expects ESM input. If you set this to `CommonJS`, `import` would be compiled to `require()`, which Vite can't tree-shake.

- **`moduleResolution: "bundler"`** — How TypeScript finds modules when you write `import X from "Y"`. Options:
  - `node` (legacy): Mimics Node.js CommonJS resolution. Doesn't understand `exports` field in package.json.
  - `node16`/`nodenext`: Mimics Node.js ESM resolution. Requires file extensions in imports.
  - `bundler`: Mimics how bundlers (Vite, webpack) resolve — understands `exports` field, doesn't require file extensions. **This is what we need** because our UI package uses the `exports` field.

- **`esModuleInterop: true`** — Allows `import React from "react"` instead of `import * as React from "react"`. Without it, default imports from CommonJS modules (like React) would fail.

- **`forceConsistentCasingInFileNames: true`** — Prevents `import from "./Button"` when the file is `button.tsx`. macOS/Windows file systems are case-insensitive, so this works locally but breaks on Linux (CI/CD). This catches it early.

- **`strict: true`** — Enables all strict type-checking options at once: `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny`, etc. You want this. The bugs it catches are worth the initial effort.

- **`skipLibCheck: true`** — Skips type-checking `.d.ts` files from `node_modules`. This dramatically speeds up compilation. The tradeoff: if a library ships broken types, you won't catch it. In practice, this is almost always worth it.

- **`isolatedModules: true`** — Ensures every file can be transpiled independently (by esbuild). Disallows TypeScript features that require whole-program analysis, like `const enum` across files. Required because Vite uses esbuild, which transpiles one file at a time.

- **`resolveJsonModule: true`** — Allows `import data from "./data.json"`. TypeScript will infer the JSON structure as a type.

#### `vite.json` — For Apps

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "noEmit": true
  }
}
```

- **`jsx: "react-jsx"`** — Uses the React 17+ JSX transform. You don't need `import React from "react"` at the top of every file. The compiler auto-injects `import { jsx } from "react/jsx-runtime"`. If you use `"react"` instead, you'd need the manual import.

- **`lib: ["ES2020", "DOM", "DOM.Iterable"]`** — Which type definitions to include:
  - `ES2020`: Types for `Promise`, `Map`, `Set`, `Optional Chaining`, etc.
  - `DOM`: Types for `document`, `window`, `HTMLElement`, etc.
  - `DOM.Iterable`: Types for `NodeList.forEach()`, `HTMLCollection[Symbol.iterator]()`, etc.
  - Not included: `WebWorker` (we're not using workers)

- **`noEmit: true`** — TypeScript only type-checks; it doesn't write any JavaScript output. Vite/esbuild handles the actual transpilation. This means `tsc` is purely a linter in this setup.

#### `ui.json` — For the UI Package

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

- **`declaration: true`** — Generates `.d.ts` type declaration files. Even though we're not pre-building, this helps IDEs provide better IntelliSense when consuming the package.
- **`declarationMap: true`** — Maps `.d.ts` files back to `.tsx` source. Enables "Go to Definition" in VS Code to jump to the actual source code instead of the declaration file.

---

### 3. Shared UI Package (`packages/ui`)

This is the core of the monorepo — where all shadcn/ui components live.

#### `package.json` — Subpath Exports (The Most Important File)

```json
{
  "name": "@workspace/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./hooks/*": "./src/hooks/*.ts",
    "./styles/*": "./src/styles/*"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.474.0",
    "tailwind-merge": "^3.0.1",
    "tw-animate-css": "^1.2.5"
  },
  "peerDependencies": {
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5.7.3"
  }
}
```

**`"type": "module"`** — Tells Node.js (and tools) that `.js` files in this package use ESM (`import`/`export`), not CommonJS (`require`/`module.exports`). Without this, Vite may misinterpret the module format.

**`"exports"` — Deep dive**:

The `exports` field is a Node.js feature (introduced in v12.7) that controls what other packages can import from yours. It's like a public API declaration:

```json
"exports": {
  "./components/*": "./src/components/*.tsx",
}
```

This means:
- `import { Button } from "@workspace/ui/components/button"` ✅ (resolves to `src/components/button.tsx`)
- `import { cn } from "@workspace/ui/lib/utils"` ✅ (resolves to `src/lib/utils.ts`)
- `import { something } from "@workspace/ui/src/internal"` ❌ (not exported, blocked)

The `*` is a wildcard pattern. `./components/*` matches any subpath after `components/`. The `*` in `*.tsx` substitutes the captured value. So:
```
@workspace/ui/components/button → ./src/components/button.tsx
@workspace/ui/components/card   → ./src/components/card.tsx
```

**Why NOT use a barrel file (`index.ts`)?**

You could do:
```ts
// packages/ui/src/index.ts
export { Button } from "./components/button"
export { Card } from "./components/card"
```

Problems:
1. You must manually update the barrel every time you add a component
2. Importing one component loads ALL component source code during type-checking
3. Bundle tools may not tree-shake perfectly across re-exports

Subpath exports solve all three: each component is an independent entry point.

**`dependencies` vs `peerDependencies` vs `devDependencies`**:

```
dependencies:      Packages this code NEEDS to run
peerDependencies:  Packages the CONSUMER must provide
devDependencies:   Packages only needed during development
```

- **`@radix-ui/react-slot`** is a `dependency` because the Button code directly imports it. Whoever installs `@workspace/ui` gets `@radix-ui/react-slot` automatically.

- **`react`** is a `peerDependency` because:
  - React uses a singleton pattern (hooks state is stored in a shared fiber tree)
  - If the UI package bundled its own React and the app used another copy, hooks would crash with "Invalid hook call"
  - `peerDependencies` says: "I need React, but YOU (the app) must provide it"
  - `"^18 || ^19"` means it works with either major version

- **`@types/react`** is a `devDependency` because types are only needed during development (type-checking, IDE support). They're stripped out at runtime.

- **`typescript`** is a `devDependency` because it's only used by `tsc` during development, not at runtime.

#### `components.json` — shadcn CLI Config

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@workspace/ui/components",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components",
    "lib": "@workspace/ui/lib",
    "hooks": "@workspace/ui/hooks"
  },
  "iconLibrary": "lucide"
}
```

**What each field controls**:

- **`style: "default"`** — Component visual style. Options: `"default"` (shadcn's standard look) or `"new-york"` (more compact, different defaults).

- **`rsc: false`** — React Server Components. Set to `false` because Vite doesn't support RSC (that's a Next.js feature). When `true`, the CLI adds `"use client"` directives to client components.

- **`tsx: true`** — Generate TypeScript `.tsx` files. If `false`, generates JavaScript `.jsx` files.

- **`tailwind.config: ""`** — Empty string because Tailwind v4 doesn't use a config file. In v3, this would point to `tailwind.config.js`.

- **`tailwind.css`** — Where the shadcn CLI writes CSS variable definitions when you run `init`. Points to our shared theme file.

- **`tailwind.cssVariables: true`** — Use CSS variables for theming instead of hardcoded Tailwind classes. This enables dark mode and custom themes.

- **`aliases`** — When the CLI generates a component that imports another component or utility, it uses these paths. Example: the Button component's source code contains `import { cn } from "@workspace/ui/lib/utils"` because we set `utils` alias to `"@workspace/ui/lib/utils"`.

- **`iconLibrary: "lucide"`** — Which icon library component code should use. `lucide-react` is a tree-shakeable icon set (only icons you import are bundled).

#### `src/lib/utils.ts` — The `cn()` Utility

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**What**: A helper that merges CSS class names intelligently.

**Why two libraries?**

`clsx` handles conditional class joining:
```ts
clsx("text-red", false && "hidden", undefined, "font-bold")
// → "text-red font-bold"
```

`tailwind-merge` resolves Tailwind class conflicts:
```ts
twMerge("px-4 px-6")       // → "px-6"     (last wins)
twMerge("text-red text-blue") // → "text-blue" (last wins)
```

Without `twMerge`, you'd get `"px-4 px-6"` and the browser would apply whichever CSS rule has higher specificity (unpredictable).

**Why wrap them in `cn()`?** Combining both gives you a single function for components:
```tsx
<button className={cn(
  "px-4 py-2",                    // base styles
  variant === "large" && "px-8",  // conditional override
  className                        // user override
)}>
```

`clsx` handles the conditional logic, then `twMerge` ensures `px-8` beats `px-4` and the user's `className` wins over defaults.

**`type ClassValue`** — This is a type-only import (`import { type ClassValue }`). The `type` keyword tells the bundler "this is only for TypeScript, strip it completely." Without `type`, some bundlers might try to include the import at runtime.

#### `src/styles/globals.css` — Tailwind v4 Theme

This file is the single source of truth for the design system. Key parts:

```css
@custom-variant dark (&:is(.dark *));
```

**What**: Defines how `dark:` variant works. When you write `dark:bg-black`, it compiles to `.dark * { background: black }`.

**Why `&:is(.dark *)`**: This means "match any element that is inside an element with the `.dark` class." You toggle dark mode by adding `class="dark"` to `<html>`. This is the "class strategy" — as opposed to `@media (prefers-color-scheme: dark)` which follows OS preferences.

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.985 0 0);
  /* ... */
}
```

**What**: CSS custom properties (variables) that change between light and dark mode.

**Why oklch?** Three values: `lightness (0-1)`, `chroma (saturation)`, `hue (0-360)`:
- `oklch(1 0 0)` = white (lightness 1, no color)
- `oklch(0 0 0)` = black (lightness 0)
- `oklch(0.577 0.245 27.325)` = a specific red

oklch is perceptually uniform — changing the hue doesn't change perceived brightness. In HSL, `hsl(60, 100%, 50%)` (yellow) looks way brighter than `hsl(240, 100%, 50%)` (blue) even though lightness is the same.

```css
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
  /* ... */
}
```

**What**: The `@theme` directive (Tailwind v4) registers CSS variables as Tailwind design tokens.

**Why**: Without this, Tailwind doesn't know about your CSS variables. `@theme` maps `--color-primary` to the `primary` color token, so `bg-primary`, `text-primary`, `border-primary` all work.

**Why `inline`?** The `inline` keyword means "don't generate a `:root` block for these values — just reference the existing CSS variables." Without `inline`, Tailwind would duplicate the values in a new `:root` block.

```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**What**: Sets default styles for all elements and the body.

**Why `@layer base`**: CSS layers control specificity ordering. Tailwind defines three layers: `base` < `components` < `utilities`. Base styles have the lowest priority, so utility classes always win. If you wrote these styles without `@layer`, they might override utilities due to source order.

**Why `* { border-border }`**: Sets the default border color for all elements. shadcn components use `border` classes extensively. Without this default, borders would be black (browser default) instead of the theme color.

**Important**: This file does NOT include `@import "tailwindcss"` or `@import "tw-animate-css"`. Each app imports those independently. Why? CSS `@import` resolves packages from the file's physical directory. `globals.css` is in `packages/ui/src/styles/`, but `tailwindcss` is only installed in the apps' `node_modules`. pnpm's strict isolation prevents cross-package resolution.

---

### 3b. Shared Firebase Package (`packages/firebase`)

This package provides Firebase authentication shared across both apps.

#### `package.json`

```json
{
  "name": "@workspace/firebase",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./config/*": "./src/config/*.ts",
    "./context/*": "./src/context/*.tsx",
    "./hooks/*": "./src/hooks/*.ts"
  },
  "dependencies": {
    "firebase": "^11.0.0"
  },
  "peerDependencies": {
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19"
  }
}
```

Same pattern as the UI package — source-level exports, no build step. The `exports` field maps three subpaths:

- `@workspace/firebase/config/firebase` → Firebase app initialization and `auth` instance
- `@workspace/firebase/context/AuthContext` → `AuthProvider` component with `onAuthStateChanged` listener
- `@workspace/firebase/hooks/useAuth` → `useAuth()` hook exposing `user`, `loading`, `signIn`, `signUp`, `signOut`

#### How shared auth works across two SPAs

Firebase Auth stores the session in the browser's IndexedDB (default persistence). Since both apps are served from the same origin (`localhost:5173` in dev, same domain in production), they share the same IndexedDB database. This means:

1. User signs in on `/auth` → Firebase writes session to IndexedDB
2. User navigates to `/` (dashboard) → Firebase reads the same IndexedDB → user is authenticated
3. No cookies, no tokens passed via URL — it's automatic because same origin = same storage

Both apps wrap their root `<App />` in `<AuthProvider>`:

```tsx
// apps/dashboard/src/main.tsx
import { AuthProvider } from "@workspace/firebase/context/AuthContext"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

#### Auth flow

- **Dashboard**: If `loading`, show spinner. If no `user`, redirect to `/auth`. Otherwise render the dashboard with navbar showing avatar + dropdown with logout.
- **Auth**: If `loading`, show spinner. If `user` exists, redirect to `/`. Otherwise show login/signup forms.

---

### 4. Dashboard App (`apps/dashboard`)

#### `package.json`

```json
{
  "name": "@workspace/dashboard",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  },
  "dependencies": {
    "@workspace/ui": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "@workspace/typescript-config": "workspace:*",
    "tailwindcss": "^4.0.0",
    "tw-animate-css": "^1.2.5",
    "typescript": "^5.7.3",
    "vite": "^6.1.0"
  }
}
```

**`"build": "tsc -b && vite build"`** — Two-step build:

1. **`tsc -b`** (TypeScript build mode) — Type-checks ALL files referenced by `tsconfig.json`. If there are type errors, it fails here and `vite build` never runs. This is your safety net — Vite/esbuild deliberately ignores type errors for speed.

2. **`vite build`** — Bundles the app for production using Rollup + esbuild. Outputs to `dist/`.

The `&&` operator means "only run the second command if the first succeeds." If `tsc` finds errors, the build stops.

**Why `tsc -b` not `tsc --noEmit`?** `-b` is "build mode" — it understands project references (the `references` array in `tsconfig.json`). `--noEmit` is for single projects. `-b` is faster for multi-project setups because it checks each project independently and caches results.

**Why `react` and `react-dom` are `dependencies` (not `devDependencies`)**: They're needed at runtime. The bundled JavaScript code calls `React.createElement`, `ReactDOM.render`, etc. Even though Vite inlines them during build, semantically they're runtime dependencies. This distinction matters if you ever do SSR or if tools inspect your dependency graph.

**Why `tailwindcss` is a `devDependency`**: Tailwind processes your CSS at build time and generates plain CSS. The `tailwindcss` package itself is never shipped to the browser — only the generated CSS is.

#### `vite.config.ts`

```ts
import path from "node:path"
import { defineConfig, type PluginOption } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function authRedirect(): PluginOption {
  return {
    name: "auth-redirect",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
          if (req.url === "/auth") {
            req.url = "/auth/"
          }
          next()
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), authRedirect()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
})
```

**`defineConfig()`** — Not strictly needed (you can export a plain object), but it gives you TypeScript autocomplete for all Vite options.

**`react()`** — This plugin does two things:
1. **Development**: Injects React Fast Refresh (HMR for React). When you edit a component, its state is preserved and only the changed component re-renders.
2. **Production**: Transforms JSX using the React automatic runtime.

**`tailwindcss()`** — The Tailwind v4 Vite plugin. It:
1. Intercepts CSS files containing `@import "tailwindcss"`
2. Scans the module graph for Tailwind class usage
3. Generates only the CSS utilities your code actually uses
4. In dev: updates via HMR when you add/remove classes

**`resolve.alias`** — Maps `@` to `src/` so components can use clean imports like `import { Navbar } from "@/components/navbar"`. Note: `tsconfig.app.json` also has a matching `paths` entry (`"@/*": ["./src/*"]`) for TypeScript/IDE support. Both are needed — tsconfig `paths` handles type-checking, Vite `resolve.alias` handles runtime resolution.

**`authRedirect()` plugin** — See the [Dev Proxy](#dev-proxy-accessing-both-apps-on-one-port) section for details.

**Why no `resolve.alias` for `@workspace/ui`?** Vite resolves workspace packages through pnpm's symlinks and the package's `exports` field. No alias needed.

#### `tsconfig.json` — Project References

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**What**: A "solution-style" tsconfig that references sub-projects.

**Why `"files": []`**: This root tsconfig doesn't directly include any files — it just orchestrates sub-projects. Without `"files": []`, TypeScript would default to including everything in the directory.

**Why two sub-projects?**
- `tsconfig.app.json` — For app source code (React, DOM, browser APIs)
- `tsconfig.node.json` — For config files like `vite.config.ts` (Node.js APIs, no DOM)

These need different `lib` and `types` settings. `vite.config.ts` runs in Node.js and shouldn't have access to `document` or `window`. App code shouldn't have access to `process` or `__dirname`.

#### `tsconfig.app.json` — Path Aliases

```json
{
  "extends": "@workspace/typescript-config/vite.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/ui/*": ["../../packages/ui/src/*"],
      "@workspace/firebase/*": ["../../packages/firebase/src/*"]
    }
  },
  "include": ["src"]
}
```

**`baseUrl: "."`** — Required when using `paths`. All paths are resolved relative to this directory (the app root).

**`paths`** — Tells TypeScript where to find types for import paths. This is for TYPE CHECKING ONLY — it does NOT affect runtime resolution (Vite handles that via the `exports` field).

- `"@/*": ["./src/*"]` — `import { Navbar } from "@/components/navbar"` → looks in `./src/components/navbar`
- `"@workspace/ui/*": ["../../packages/ui/src/*"]` — `import { Button } from "@workspace/ui/components/button"` → TypeScript finds types at `../../packages/ui/src/components/button.tsx`
- `"@workspace/firebase/*": ["../../packages/firebase/src/*"]` — `import { useAuth } from "@workspace/firebase/hooks/useAuth"` → TypeScript finds types at `../../packages/firebase/src/hooks/useAuth.ts`

**Why is this needed if `exports` already maps the paths?** TypeScript's `moduleResolution: "bundler"` does understand `exports`, but `paths` gives it direct access to the source `.tsx` files. This provides:
- Accurate type inference from the actual source (not just `.d.ts` files)
- "Go to Definition" jumps to the real implementation
- Faster type-checking (no need to generate/find declaration files)

**`include: ["src"]`** — Only type-check files inside `src/`. Without this, TypeScript would check every `.ts`/`.tsx` file in the project, including `node_modules` (slow and error-prone).

#### Refactored Component Structure

The dashboard app is split into small, focused components:

```
src/
├── App.tsx                    # ~30 lines — auth guard + composition
├── components/
│   ├── navbar.tsx             # Avatar + DropdownMenu with logout
│   ├── stats-cards.tsx        # 4 metric cards (static)
│   ├── team-members.tsx       # Search input + filtered member list (own state)
│   ├── recent-activity.tsx    # Activity feed card
│   └── quick-message.tsx      # Textarea + send button (own state)
└── data/
    └── dashboard-data.ts      # TeamMember/Activity types + static arrays
```

Each component is self-contained — `team-members.tsx` owns its `search` state, `quick-message.tsx` owns its `message` state. `App.tsx` only handles auth and layout composition.

#### `src/index.css` — Tailwind Entry Point

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@workspace/ui/styles/globals.css";

@source "../../../packages/ui/src";
```

**Import order matters**:
1. **`tailwindcss`** — The Tailwind base: CSS reset (`preflight`), base styles, and the utility class engine.
2. **`tw-animate-css`** — Animation utilities (`animate-in`, `animate-out`, etc.) used by shadcn components like Dialog, Dropdown, etc.
3. **`globals.css`** — Our theme variables and base overrides. Must come after `tailwindcss` so our `@layer base` styles override Tailwind's defaults.

**`@source "../../../packages/ui/src"`**

**What**: Tells Tailwind v4 to scan this directory for class names to generate.

**Why it's needed**: Tailwind v4's `@tailwindcss/vite` plugin auto-detects classes from files in Vite's module graph. But pnpm workspace symlinks can confuse this detection. Tailwind might not realize that `packages/ui/src/components/button.tsx` contains classes like `bg-primary`, `rounded-md`, `px-4`.

**What happens without it**: Buttons render as unstyled `<button>` elements. The HTML has `class="bg-primary px-4 ..."` but no CSS is generated for those classes, so the browser ignores them.

**The relative path**: `../../../packages/ui/src` goes from `apps/dashboard/src/` → up to `apps/dashboard/` → up to `apps/` → up to root → down to `packages/ui/src/`. This path is relative to the CSS file's location.

---

### 5. Auth App (`apps/auth`)

Almost identical to dashboard, with these differences:

| Aspect | Dashboard | Auth |
|--------|-----------|------|
| Config | `tsconfig.json` | `jsconfig.json` |
| Vite config | `vite.config.ts` | `vite.config.js` |
| Build script | `tsc -b && vite build` | `vite build` |
| Dev port | 5173 (Vite default) | 5174 (explicit `--port`) |
| TypeScript deps | `typescript`, `@types/*` | None |

**How does a JS app consume TypeScript components?**

This is the key insight of the source-level export strategy:

1. auth imports `@workspace/ui/components/button`
2. pnpm resolves this to `packages/ui/src/components/button.tsx` (via `exports`)
3. Vite sees a `.tsx` file in its module graph
4. esbuild strips the TypeScript types and transforms JSX → JavaScript
5. The browser receives plain JavaScript

esbuild does NOT type-check — it literally deletes the types. `interface ButtonProps { ... }` → removed entirely. `as HTMLButtonElement` → removed. The output is valid JavaScript.

This is why the auth doesn't need TypeScript installed. The TypeScript-to-JavaScript conversion happens inside Vite's pipeline, not as a separate step.

#### `jsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/ui/*": ["../../packages/ui/src/*"],
      "@workspace/firebase/*": ["../../packages/firebase/src/*"]
    }
  },
  "include": ["src"]
}
```

**What**: A `jsconfig.json` is literally a `tsconfig.json` with `allowJs: true` and `checkJs: false` implied. It exists purely for IDE support.

**Why it matters**: Without this file, VS Code won't understand `@workspace/ui/components/button` imports. You'd get red squiggles everywhere and no autocomplete. The `paths` mapping gives VS Code the same resolution as Vite uses at runtime.

#### `vite.config.js`

```js
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  base: "/auth/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
```

Same `resolve.alias` pattern as dashboard — maps `@` to `src/` for clean imports. The `base: "/auth/"` is explained in the [Vercel Deployment](#vercel-deployment) section.

#### Refactored Component Structure

```
src/
├── App.jsx                  # ~30 lines — auth guard + view toggle
├── components/
│   ├── navbar.jsx           # "Workspace" branding + Login button
│   ├── login-form.jsx       # Email/password form with Firebase signIn
│   └── signup-form.jsx      # Registration form with validation + Firebase signUp
└── lib/
    └── firebase-errors.js   # Maps Firebase error codes to user-friendly messages
```

`App.jsx` toggles between `LoginForm` and `SignupForm` via a `view` state. Each form component is self-contained with its own form state, validation, and error handling.

---

### 6. Install & Add Components

```bash
# Install all dependencies
pnpm install

# Add a shadcn component (e.g., button)
pnpm ui:add button

# Add more components
pnpm ui:add card
pnpm ui:add input
```

**What `pnpm install` does in a workspace**:
1. Reads `pnpm-workspace.yaml` to find all workspace members
2. Resolves all dependencies across all workspaces
3. Downloads packages to the global content-addressable store
4. Creates `node_modules` in each workspace with symlinks
5. Creates workspace symlinks (e.g., `apps/dashboard/node_modules/@workspace/ui` → `packages/ui`)
6. Generates `pnpm-lock.yaml` (the lockfile)

**What `pnpm ui:add button` does**:
1. `pnpm dlx shadcn@latest` downloads the latest shadcn CLI into a temp location and runs it
2. `add button` tells it to fetch the Button component from the shadcn registry
3. `--cwd packages/ui` makes it read `packages/ui/components.json`
4. The CLI writes `packages/ui/src/components/button.tsx`
5. It also runs `pnpm add @radix-ui/react-slot` in the ui package (Button's dependency)

The component is immediately importable from both apps — no restart needed. Vite's dev server detects the new file and makes it available.

---

## How Everything Connects

Here's the full chain when a user visits dashboard in the browser:

```
Browser requests http://localhost:5173/
  → Vite serves index.html
  → Browser loads /src/main.tsx (as ESM)
  → main.tsx wraps App in AuthProvider from "@workspace/firebase/context/AuthContext"
  → AuthProvider initializes Firebase and listens for auth state via onAuthStateChanged
  → App.tsx checks user/loading from useAuth()
  → If not authenticated → window.location.href = "/auth" (redirects to auth app)
  → If authenticated → renders Navbar + dashboard components
  → Components import from "@workspace/ui/components/*"
  → Vite resolves "@workspace/ui" via pnpm symlink → esbuild transpiles .tsx

For CSS:
  → main.tsx imports "./index.css"
  → @tailwindcss/vite plugin intercepts it
  → Processes @import "tailwindcss" (injects base styles)
  → Processes @import "tw-animate-css" (injects animations)
  → Processes @import "@workspace/ui/styles/globals.css" (injects theme)
  → Scans @source path for class names
  → Generates CSS only for classes actually used
  → Browser receives complete styled CSS

Auth flow:
  → Unauthenticated user lands on /auth
  → Auth app renders LoginForm or SignupForm
  → User submits credentials → Firebase signIn/signUp
  → Firebase stores session in IndexedDB
  → window.location.href = "/" → redirects to dashboard
  → Dashboard's AuthProvider reads same IndexedDB → user is authenticated
```

---

## Gotchas & Lessons Learned

### 1. pnpm Strict Isolation + TypeScript Types

**Problem**: `tsc` in dashboard type-checks files from `packages/ui` (via path aliases). When processing `button.tsx`, tsc sees `import * as React from "react"` and tries to find `@types/react` by walking up from `packages/ui/src/components/`. With pnpm's strict isolation, `@types/react` is only in each workspace's isolated `node_modules` — not findable via the parent directory walk.

**Fix**: `public-hoist-pattern[]=@types/*` in `.npmrc` hoists type packages to root `node_modules`, making them findable from any directory in the repo.

### 2. CSS `@import` Resolution in Monorepos

**Problem**: `@import "tailwindcss"` in `globals.css` (located at `packages/ui/src/styles/`) tries to resolve `tailwindcss` from that directory. But `tailwindcss` is only a `devDependency` of the apps, not the UI package. pnpm doesn't make it available in `packages/ui/node_modules`.

**Fix**: Move `@import "tailwindcss"` and `@import "tw-animate-css"` to each app's `index.css` (where tailwindcss IS installed). The shared `globals.css` only contains theme definitions — no package imports.

### 3. Tailwind v4 Content Detection in Monorepos

**Problem**: Tailwind v4's Vite plugin scans the module graph for class names. But workspace-linked packages resolved through symlinks may not be included in the scan. Result: components have the right HTML classes, but no CSS is generated for them (invisible buttons).

**Fix**: Add `@source "../../../packages/ui/src"` in each app's CSS to explicitly tell Tailwind to scan the UI package's source directory.

### 4. shadcn CLI `--cwd` vs `--filter`

**Problem**: The root `ui:add` script initially tried `pnpm --filter @workspace/ui dlx shadcn@latest add`. But `pnpm dlx` doesn't support the `--filter` flag — that's for `pnpm run` and `pnpm add`.

**Fix**: Use `pnpm dlx shadcn@latest add --cwd packages/ui` instead. `--cwd` is a shadcn CLI flag (not pnpm's), telling it to look for `components.json` in that directory.

---

## Mental Models for Monorepo Thinking

### "Who resolves what?"

There are THREE different resolution systems at play, and confusing them causes most monorepo bugs:

| System | Resolves | Used by |
|--------|----------|---------|
| **Node.js / pnpm** | `node_modules` symlinks, `exports` field | Runtime, `pnpm install` |
| **TypeScript** | `paths` in tsconfig, `moduleResolution` | `tsc` type-checking, IDE |
| **Vite / esbuild** | Module graph, symlinks, `exports` field | Dev server, production build |

When an import works in the browser but tsc complains, the issue is with TypeScript resolution (check `paths`).
When tsc passes but the browser shows errors, the issue is with Vite resolution (check `exports`).
When both fail, the issue is with pnpm (check `workspace:*` links).

### "Where does this run?"

Always ask yourself: where does this code/config execute?

- `package.json` → Read by pnpm (install), Node.js (module resolution), Turborepo (task orchestration)
- `tsconfig.json` → Read by tsc (type-checking), VS Code (IntelliSense)
- `vite.config.ts` → Executed by Node.js (at build time), NOT in the browser
- `*.tsx` components → Transpiled by esbuild, executed in the browser
- `*.css` → Processed by `@tailwindcss/vite` at build time, output CSS runs in browser

### "Source vs built"

Our UI package exports **source** (`.tsx` files). This is unusual — most packages export **built** JavaScript (`.js` + `.d.ts`). Tradeoffs:

| Aspect | Source exports | Built exports |
|--------|---------------|---------------|
| Dev speed | Faster (no build step) | Slower (must rebuild on change) |
| HMR | Instant | Requires rebuild |
| Compatibility | Only works with bundlers that handle TSX | Works everywhere |
| Type checking | Consumer's tsc checks the source | Consumer only sees `.d.ts` |
| CI build time | Faster (one build step) | Slower (build UI, then build apps) |

Source exports work perfectly for internal monorepo packages consumed by Vite apps. If you ever publish the UI package to npm, you'd need to add a build step.

---

## Vercel Deployment

Both apps are deployed as a single Vercel project with path-based routing: dashboard at `/` and auth at `/auth`.

### `vercel.json`

```json
{
  "framework": null,
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build && cp -r apps/auth/dist apps/dashboard/dist/auth",
  "outputDirectory": "apps/dashboard/dist",
  "rewrites": [
    { "source": "/auth", "destination": "/auth/index.html" },
    { "source": "/auth/((?!assets/).*)", "destination": "/auth/index.html" },
    { "source": "/((?!assets/|auth/).*)", "destination": "/index.html" }
  ]
}
```

**`"framework": null`** — Tells Vercel not to auto-detect a framework. Since this is a monorepo with a custom build setup, we configure everything manually. Without this, Vercel might detect Vite and apply defaults that conflict with our multi-app setup.

**`"buildCommand"`** — Two steps:
1. `pnpm build` — Turborepo builds both apps in parallel (respecting dependency order)
2. `cp -r apps/auth/dist apps/dashboard/dist/auth` — Copies auth's build output INTO dashboard's dist as a subdirectory

After this, the file structure is:
```
apps/dashboard/dist/
├── index.html           ← dashboard
├── assets/              ← dashboard JS/CSS
└── auth/
    ├── index.html       ← auth
    └── assets/          ← auth JS/CSS
```

**`"outputDirectory": "apps/dashboard/dist"`** — Vercel serves this single directory. It contains both apps.

**`"rewrites"` — SPA Fallback Rules**:

SPAs use client-side routing — all routes should serve the same `index.html` and let JavaScript handle the URL. But with two SPAs on one domain, we need careful rules:

1. **`/auth` → `/auth/index.html`** — Exact match for `/auth` (no trailing slash). Without this, Vercel would look for a file literally named `auth` (not a directory).

2. **`/auth/((?!assets/).*)`** — Matches any `/auth/*` path EXCEPT `/auth/assets/*`. The `(?!assets/)` is a negative lookahead — it says "match anything after `/auth/` as long as it doesn't start with `assets/`." This ensures:
   - `/auth/login` → serves `/auth/index.html` (SPA handles routing)
   - `/auth/assets/index.js` → serves the actual JS file (not rewritten)

3. **`/((?!assets/|auth/).*)`** — Matches any root path EXCEPT `/assets/*` and `/auth/*`. This is the dashboard's SPA fallback:
   - `/dashboard` → serves `/index.html`
   - `/settings` → serves `/index.html`
   - `/assets/main.js` → serves the actual file
   - `/auth/anything` → NOT matched (handled by rule 2)

**Why `(?!...)` negative lookahead?** Asset files (JS, CSS, images) must be served as-is. If we rewrote `/assets/main.js` to `/index.html`, the browser would get HTML instead of JavaScript and the app would break.

### Auth App `base` Path

```js
// apps/auth/vite.config.js
export default defineConfig({
  base: "/auth/",
  // ...
})
```

**What**: The `base` option prepends `/auth/` to all asset URLs in the production build.

**Why**: Without it, auth's `index.html` would reference `/assets/index.js`. But on the deployed site, auth's assets live at `/auth/assets/index.js`. With `base: "/auth/"`, all generated URLs are prefixed correctly:

```html
<!-- Without base -->
<script src="/assets/index.js"></script>

<!-- With base: "/auth/" -->
<script src="/auth/assets/index.js"></script>
```

**Important**: `base` also affects the dev server. The auth dev server serves at `http://localhost:5174/auth/` (not the root).

---

## Dev Proxy (Accessing Both Apps on One Port)

During development, each app runs on its own port (dashboard on 5173, auth on 5174). To mirror production behavior where both live on one origin, the dashboard's `vite.config.ts` includes a proxy:

### `apps/dashboard/vite.config.ts`

```ts
import { defineConfig, type PluginOption } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function authRedirect(): PluginOption {
  return {
    name: "auth-redirect",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
          if (req.url === "/auth") {
            req.url = "/auth/"
          }
          next()
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), authRedirect()],
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
})
```

**How it works**:

1. **`server.proxy`** — Vite's built-in HTTP proxy (powered by `http-proxy`). Any request starting with `/auth` is forwarded to `http://localhost:5174` (where the auth dev server runs). This includes HTML, JS, CSS, WebSocket (HMR), and all other requests.

2. **`authRedirect` plugin** — A custom Vite plugin that rewrites `/auth` → `/auth/` before the proxy handles it. This is needed because the auth app's `base: "/auth/"` requires the trailing slash. Without the rewrite, visiting `http://localhost:5173/auth` returns 404 — only `/auth/` works.

3. **`configureServer`** — A Vite plugin hook that gives access to the underlying connect middleware server. The middleware runs before the proxy, so the URL rewrite happens first.

4. **`changeOrigin: true`** — Changes the `Host` header in proxied requests to match the target (`localhost:5174`). Some servers check the `Host` header and reject requests that don't match.

**Why `@types/node` is needed**: The `IncomingMessage` and `ServerResponse` types come from Node.js's `http` module. Since `vite.config.ts` runs in Node.js, we added `@types/node` as a dev dependency and `"types": ["node"]` to `tsconfig.node.json`.

**Result**: During dev, you can access everything from one origin:
- `http://localhost:5173/` → Dashboard (served directly)
- `http://localhost:5173/auth` → Auth (proxied to port 5174)

---

## Testing Production Build Locally

```bash
# Build both apps
pnpm build

# Copy auth output into dashboard's dist (same as Vercel build command)
cp -r apps/auth/dist apps/dashboard/dist/auth

# Serve the combined output
npx serve apps/dashboard/dist
```

Visit `http://localhost:3000` for dashboard and `http://localhost:3000/auth` for auth.

---

## Common Commands

```bash
# Start both apps in dev mode
pnpm dev

# Start a single app
pnpm --filter @workspace/dashboard dev
pnpm --filter @workspace/auth dev

# Build all workspaces for production
pnpm build

# Add a shadcn component to the shared UI package
pnpm ui:add <component-name>

# Install a dependency in a specific workspace
pnpm --filter @workspace/ui add <package>
pnpm --filter @workspace/dashboard add -D <package>
pnpm --filter @workspace/auth add -D <package>

# Check what workspaces exist
pnpm ls --depth -1

# See the dependency graph
pnpm why <package-name>
```

## Ports

| App       | Direct URL                   | Via Proxy (dashboard)        |
|-----------|------------------------------|------------------------------|
| Dashboard | http://localhost:5173        | —                            |
| Auth      | http://localhost:5174/auth/  | http://localhost:5173/auth   |
