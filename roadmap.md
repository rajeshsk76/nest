# Roadmap

## North star

Org mode for people who won’t install Emacs. Plain `.org` files you own. Capture and Today first — not Emacs parity.

## Shipped

- **Web** — Vite + React outline, uniorg parse → edit → stringify, Capture, Today, fixtures / localStorage
- **Desktop** — Tauri 2, folder on disk as truth, native picker, `inbox.org` / `projects.org`
- **Tags & priorities** — `[#A/B/C]`, `:tag:`, Today filters + sort; Capture parses `#A` / `:tag:`
- **Ops** — auto-seed sample orgs; free port **5173** before Vite / `tauri:dev`

## Next

Ordered for habit value and Emacs coexistence:

1. **SCHEDULED / DEADLINE** picker in UI (real Org timestamps)
2. **Reload on external edit** — refresh when Emacs (or anything) changes the file
3. **7-day agenda** strip (not a full Org agenda)
4. **Refile** inbox → projects

## Later maybe

Harder round-trip tests; open in Emacs / reveal in file manager; optional git status for the workspace; icons / one-command desktop first run; free local forever, optional Pro sync only if it never locks the format.

## Not on the map

- Full Org agenda, sparse trees, column view
- Babel, publish, org-roam
- AI that owns or rewrites your files

## Rule

Every feature must make **Capture** or **Today** stickier, or protect the `.org` round-trip. Everything else waits.
