links

LIVE PROJECT HERE: https://workspace-ystq.onrender.com/

https://github.com/Shprotya/mongo.git

https://luma.link/BXY2O68NEX

https://claude.ai/share/564ab57c-9d49-4275-b8b1-47a43acd022c
https://claude.ai/artifact/PaaN1WPtb8VbAKwmLJRyhJ#0682a939-ae1d
https://chat.whatsapp.com/ITVBJvX7zSg18zAHz88e3d

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


## HOW TO INSTALL PNPM ON LINUX

## Setting up from scratch

### 1. Get Node 24

**Route A — you already use a version manager like `mise`.**

```bash
mise use -g node@24
node -v
```

**Route B — from scratch, using `nvm`.**

```bash
# install nvm: https://github.com/nvm-sh/nvm
nvm install 24
nvm alias default 24
```

**Check:** `node -v` starts with `v24.`. Node 24 is the current Active LTS line (supported into 2028), and it satisfies Astro's minimum of v22.12.0 with headroom, so it's a safe default even though older even-numbered versions technically still work.

### 2. Enable pnpm

**Route A — you already have mise.** What this machine actually resolves today.

```bash
corepack enable pnpm
pnpm -v
```

**Route B — from scratch.** This is the standing personal setup route (WSL, then nvm, then corepack), with one change: Node 24, not the 22 that guide names, because this project pins 24.

```bash
npm install --global corepack@latest
corepack enable pnpm
corepack prepare pnpm@latest --activate
pnpm --version
```

Recent Node releases still bundle Corepack, Node's built-in manager for pnpm/Yarn versions — you just have to turn it on.

**Check:** `pnpm --version` prints `11.x` or higher. If `corepack enable` errors out with "command not found," install Corepack manually first: `npm install -g corepack`, then re-run `corepack enable`.

### 3. Clone and install

```bash
git clone <repo-url> valerkahere-site
cd valerkahere-site
pnpm install
```

**Heads up — a native build-script prompt is normal here.** Since pnpm 11, installs fail closed by default (`strictDepBuilds`) instead of silently running third-party postinstall scripts. This project's dependency tree pulls in `esbuild` (via Vite), which has one of those scripts to fetch its platform binary. If the install stops with `ERR_PNPM_IGNORED_BUILDS`, run:

```bash
pnpm approve-builds
```

and select `esbuild` (and `sharp`, if it's listed — some Astro image-processing paths pull it in). Re-run `pnpm install` afterward. This is a one-time approval per machine; pnpm remembers it in `pnpm-workspace.yaml`.

### 4. Run it

```bash
pnpm dev
```

Other scripts, unchanged from before: `pnpm build`, `pnpm preview`, `pnpm astro -- <command>`, `pnpm format`, `pnpm format:check`.

---


## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details
