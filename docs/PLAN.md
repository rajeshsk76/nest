# Nest — product plan

**One-liner:** Org mode for people who won’t install Emacs.  
**Source of truth:** plain `.org` files on disk (Tauri). Web mode is for UI only.

---

## Principles

1. **Wedge over parity** — Capture + Today beat full Emacs Org.
2. **Files you own** — never lock users into Nest-only formats.
3. **Ethical sticky** — habits (Capture, Today filters), not dark patterns.
4. **Every feature must** make Capture/Today stickier **or** protect the `.org` round-trip.

---

## Shipped

| Version | What’s in |
|---------|-----------|
| **v0.1** | Vite + React outline, uniorg round-trip, Capture, Today, fixtures, web localStorage |
| **v0.2** | Tauri 2 desktop, native folder picker, on-disk `inbox.org` / `projects.org`, no browser FS prompts |
| **v0.2.1** | Priorities `[#A/B/C]`, tags `:tag:`, Today filters + sort, capture parses `#A` / `:tag:` |
| **ops** | Auto-seed sample orgs, free port **5173** before `tauri:dev` / Vite |
| **Slice 1** | Elegant markup in outline (emphasis + links, display only; disk stays raw Org) |
| **Slice 2** | Structural editing: fold (view only); promote/demote/move/insert via byte-splice |
| **Slice 3** | Transparent tables: parse/edit/add-row via table-span byte-splice; Tab between cells |
| **Slice 4** | Superior source code: detect #+BEGIN_SRC; language badge + monospace body; interior-only splice |
| **Slice 5** | Export and publish: Org → single-file HTML (sibling next to .org; never replaces); web download + desktop sibling write |
| **Track B1–B5** | Scrape `#+TAGS:` / `#+FILETAGS:` for tag picker; scrape `#+STARTUP:` (overview → default fold; logdone/logrepeat read-only); rendered markup default; drawers hidden in outline; plain-language RefuseWrite. **B6 undo not yet.** |

**Repo:** https://github.com/rajeshsk76/nest

---

## Explicitly not building (now)

- Full Org agenda / sparse trees / column view  
- Babel, publish, org-roam graph  
- Multiplayer / cloud / Pro sync — **out**; contradicts local-files pitch  
- AI as core (assist pane only if it never owns the file)

---

## Next plan (ordered)

V2.2 habit polish (caret / CREATED / Today chips / CI / onboarding) ships before calendar sync.

### P0 — Make desktop feel finished
1. **Proper app icons** checked into `src-tauri/icons` (RGBA) + generate via script on clone  
2. **One-command first run** doc (Rust + apt deps + `tauri:dev`) in README “5 minutes to desktop”  
3. **External file reload** — refresh when `inbox.org` changes in Emacs (focus reload or light watch)

### P1 — Habit features (V2.2)
4. **7-day agenda** strip (still not full Org agenda)  
5. **SCHEDULED / DEADLINE picker** in UI (writes real timestamps)  
6. **Refile** inbox → projects (move headline between files)

### P2 — Trust & round-trip (V2.3)
7. **Byte-splice writes** + harder round-trip tests (drawers, properties you don’t smash); see roadmap Conformance  
8. **Open in Emacs** / reveal in file manager  
9. Optional **git status** badge for the workspace folder

### P3 — Business (when product loves)
10. Free local forever · no Pro/cloud sync (local files are the product) · optional team shared folder on disk later  
11. Website / demo GIF · “survives opening in Emacs” story

---

## Suggested next build (pick one)

| Option | Why |
|--------|-----|
| **A. Schedule + deadline UI** | Makes Today real, still on-disk Org |
| **B. 7-day agenda** | Natural extension of Today |
| **C. Reload on external edit** | Emacs users trust Nest more |
| **D. Refile inbox → projects** | Completes the Capture loop |

**Default recommendation:** **A → C → B → D** (schedule/deadline first, then Emacs coexistence, then week view, then refile).

---

## Success metrics (solo)

- D1/D7: opens Nest ≥4 days/week  
- Weekly Captures / user  
- Opens same `.org` in Emacs without fear  
- Zero “port already in use” support pain (done)

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-09-05 | Beachhead = product/tech inventors; flood then filter brainstorms |
| 2026-09-05 | Modernize Org with JS; name **Nest** |
| 2026-09-05 | No full Org mode; tags/priorities before agenda |
| 2026-09-05 | Tauri + disk folder as V2 truth |
| 2026-09-05 | Auto-free 5173 baked into `tauri:dev` |
| 2026-09-05 | Slice 1 elegant markup: display parse only; zero-edit / no structural rewrite of unedited spans |
| 2026-09-05 | Slice 2 structural editing: fold = visibility only; promote/demote/move/insert byte-splice |
| 2026-09-05 | Slice 3 transparent tables: splice only table region; preserve outside bytes + TBLFM |
| 2026-09-05 | Slice 4 superior source code: splice only src interior; preserve fences; never execute |
| 2026-09-05 | Slice 5 export: pure Org→HTML read; sibling .html only; no Reveal in this slice |

---

*Living doc — update when we ship or kill an item.*
