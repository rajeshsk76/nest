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

On install / before dev, Nest auto-seeds sample .org files under data/ (and mirrors them into public/) if they are missing or empty. Existing non-empty files are left alone.

Port **5173** is freed automatically before Vite starts (`strictPort`).

```bash
nmp test
npm run build
```

CI (GitHub Actions `.github/workflows/ci.yml`) runs `npm ci`, `npm test`, `npm run build` — including the Org compat round-trip test (headline + TODO + priority + tags + CREATED + SCHEDULED).

## Desktop (Tauri)

Needs a recent Rust toolchain (rustup) plus platform deps for Tauri 2.

```bash
npm install
npm run tauri:dev
```

`tauri:dev` frees port 5173, then starts Vite and the Nest window. Disk .org files are the source of truth.

```bash
npm run tauri:build
```

## Checks

- `npm test` — Vitest parse/stringify suite + Org compat badge
- `npm run build` — TypeScript + Vite production build

## Done when

1. App opens (web or desktop). Empty workspace shows short onboarding.
2. Capture appends a TODO with a CREATED properties drawer.
3. Today filters by priority / tag (sticky); sort A → B → C → none.
4. Headline title caret stays put while typing.
5. The matching .org still opens cleanly in Emacs.
