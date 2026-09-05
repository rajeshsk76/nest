# Build

How to run Nest locally. Short version.

## Web

```bash
git clone https://github.com/rajeshsk76/nest.git
cd nest
npm install
npm run dev
```

Open http://localhost:5173.

On install / before dev, Nest auto-seeds sample `.org` files under `data/` (and mirrors them into `public/`) if they are missing or empty. Existing non-empty files are left alone.

Port **5173** is freed automatically before Vite starts (`strictPort`). You should not need to hunt for a stuck process.

```bash
npm test
npm run build
```

## Desktop (Tauri)

Needs a recent Rust toolchain (rustup) plus platform deps for Tauri 2 (Linux: webkit2gtk / librsvg / build tools; macOS: Xcode CLT; Windows: MSVC + WebView2).

```bash
npm install
npm run tauri:dev
```

`tauri:dev` also frees port 5173, then starts Vite and the Nest window. First launch: pick a folder, or accept the default under app data (seeded `inbox.org` / `projects.org`). Disk `.org` files are the source of truth.

```bash
npm run tauri:build
```

## Checks

- `npm test` — Vitest parse/stringify suite
- `npm run build` — TypeScript + Vite production build

## Done when

1. App opens (web or desktop).
2. Capture appends a TODO.
3. Today can Mark DONE.
4. The matching `.org` still opens cleanly in Emacs (or another Org-aware editor).
