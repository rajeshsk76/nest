#!/usr/bin/env node
/**
 * nest-mcp — verification tools for Nest, over MCP.
 *
 * Exposes the checks that protect the byte-fidelity guarantee so that any
 * agent (Claude Code, Codex, Gemini, Grok) can be held to the same bar and,
 * more importantly, so the human can see in the transcript whether it was.
 *
 * Deliberately read-only. Agents already have file access; what they lack is
 * a way to be checked that they cannot route around.
 *
 *   run_gate          npm run conformance:zero-edit
 *   run_tests         vitest + tsc
 *   check_invariants  static scan for the rules a model tends to quietly break
 *   emacs_oracle      Nest's mark-DONE vs Emacs org-todo, byte compared
 *   handoff_read      read HANDOFF.md
 *   handoff_write     replace HANDOFF.md (the one write, and it touches no source)
 *
 * Run:  node scripts/nest-mcp.mjs        (stdio transport)
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const run = promisify(execFile)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const HANDOFF = path.join(ROOT, 'HANDOFF.md')

async function sh(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await run(cmd, args, {
      cwd: ROOT,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
      ...opts,
    })
    return { code: 0, out: `${stdout}${stderr}` }
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
    return { code: err.code ?? 1, out: out || String(err.message ?? '') }
  }
}

const text = (s) => ({ content: [{ type: 'text', text: s }] })

const server = new McpServer({ name: 'nest-mcp', version: '0.1.0' })

/* ------------------------------------------------------------------ gate */
server.registerTool(
  'run_gate',
  {
    title: 'Run the byte-fidelity conformance gate',
    description:
      'Runs `npm run conformance:zero-edit`. Exercises the real splice mutators over ' +
      'every headline in the corpus. Must pass before any commit. Reports the pass ' +
      'rate and every failing check.',
    inputSchema: {},
  },
  async () => {
    const r = await sh('npm', ['run', '--silent', 'conformance:zero-edit'])
    const result = /Result: .*/.exec(r.out)?.[0] ?? 'no result line'
    return text(
      `${r.code === 0 ? 'GATE PASS' : 'GATE FAIL'}\n${result}\n\n${r.out.slice(-4000)}`,
    )
  },
)

/* ----------------------------------------------------------------- tests */
server.registerTool(
  'run_tests',
  {
    title: 'Run vitest and tsc',
    description:
      'Runs `npx vitest run` and `npx tsc -b`. Both must pass before any commit. ' +
      'If either fails, stop and report — never modify a check to make it pass.',
    inputSchema: {},
  },
  async () => {
    const v = await sh('npx', ['vitest', 'run'])
    const t = await sh('npx', ['tsc', '-b'])
    return text(
      `vitest: ${v.code === 0 ? 'PASS' : 'FAIL'}\ntsc: ${t.code === 0 ? 'PASS' : 'FAIL'}\n\n` +
        `--- vitest ---\n${v.out.slice(-3000)}\n--- tsc ---\n${t.out.slice(-1500) || '(clean)'}`,
    )
  },
)

/* ------------------------------------------------------------ invariants */
const read = (rel) => {
  const f = path.join(ROOT, rel)
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
}

function listSourceFiles(rel) {
  const dir = path.join(ROOT, rel)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory()
        ? listSourceFiles(path.join(rel, d.name))
        : /\.(ts|tsx|mjs|js)$/.test(d.name)
          ? [path.join(rel, d.name)]
          : [],
    )
}

const INVARIANTS = [
  {
    name: 'stringify reaching the write path',
    why: 'Files are spliced, never regenerated. stringifyOrg is display-only.',
    check: () => {
      const w = read('src/lib/org-writes.ts')
      return w && /stringifyOrg/.test(w) ? ['src/lib/org-writes.ts mentions stringifyOrg'] : []
    },
  },
  {
    name: 'skipped or todo tests',
    why: 'A skipped test is silent forever. Fix the code or rewrite the expectation.',
    check: () =>
      listSourceFiles('src')
        .filter((f) => /\.test\./.test(f))
        .flatMap((f) =>
          (read(f) ?? '')
            .split('\n')
            .map((line, i) => (/(it|test|describe)\.(skip|todo)\s*\(/.test(line) ? `${f}:${i + 1}` : null))
            .filter(Boolean),
        ),
  },
  {
    name: 'conformance gate lowered below 95',
    why: 'The installer gate is >=95%. Only the human may change it.',
    check: () => {
      const hits = []
      for (const f of ['scripts/conformance-zero-edit.mjs', 'package.json', '.github/workflows/ci.yml']) {
        const body = read(f)
        if (!body) continue
        for (const m of body.matchAll(/gate['" :=]*\)?\s*\?\?\s*(\d+)|--gate[ =]+(\d+)/gi)) {
          const n = Number(m[1] ?? m[2])
          if (Number.isFinite(n) && n < 95) hits.push(`${f}: gate set to ${n}`)
        }
      }
      return hits
    },
  },
  {
    name: 'conformance helper shadowing src/lib',
    why: 'A check that defines its own write path tests nothing. This has happened before.',
    check: () => {
      const hits = []
      for (const f of listSourceFiles('scripts')) {
        const body = read(f) ?? ''
        if (!/conformance/i.test(f)) continue
        if (/function\s+(zeroEditWrite|spliceHead|applyEdits|markDoneInSource)/.test(body)) {
          hits.push(`${f} defines its own write-path helper`)
        }
        if (!/src\/lib/.test(body)) {
          hits.push(`${f} never references src/lib — it is not testing Nest`)
        }
      }
      return hits
    },
  },
]

server.registerTool(
  'check_invariants',
  {
    title: 'Static scan for rules agents tend to break',
    description:
      'Scans for: stringifyOrg reaching the write path, skipped tests, a lowered ' +
      'conformance gate, conformance helpers shadowing src/lib, and personal org ' +
      'files staged for commit. Run before every commit.',
    inputSchema: {},
  },
  async () => {
    const lines = []
    let violations = 0
    for (const inv of INVARIANTS) {
      let hits = []
      try {
        hits = inv.check()
      } catch (err) {
        hits = [`check errored: ${err.message}`]
      }
      if (hits.length > 0) violations += 1
      lines.push(`${hits.length > 0 ? 'VIOLATION' : 'ok       '}  ${inv.name}`)
      if (hits.length > 0) {
        lines.push(`             why: ${inv.why}`, ...hits.map((h) => `             ${h}`))
      }
    }
    const tracked = await sh('git', ['ls-files', '--', 'inbox.org', 'projects.org'])
    const staged = await sh('git', ['diff', '--cached', '--name-only', '--', 'inbox.org', 'projects.org'])
    const personal = `${tracked.out}${staged.out}`.trim()
    if (personal) {
      violations += 1
      lines.push('VIOLATION  personal org files tracked or staged')
      lines.push('             why: inbox.org and projects.org in the repo root are real tasks.')
      lines.push(...personal.split('\n').map((l) => `             ${l}`))
    } else {
      lines.push('ok         personal org files not tracked or staged')
    }
    return text(
      `${violations === 0 ? 'INVARIANTS CLEAN' : `${violations} VIOLATION(S)`}\n\n${lines.join('\n')}`,
    )
  },
)

/* ---------------------------------------------------------------- oracle */
const ORACLE_EL = `(require 'org)
(let ((idx (string-to-number (nth 1 command-line-args-left))))
  (with-temp-buffer
    (insert-file-contents (nth 0 command-line-args-left))
    (org-mode)
    (goto-char (point-min))
    (let ((n 0))
      (org-map-entries
       (lambda () (when (= n idx) (org-todo "DONE")) (setq n (1+ n)))))
    (write-region (point-min) (point-max) (nth 2 command-line-args-left) nil 'silent)))`

const GEN_TS = `import fs from 'node:fs'
import { listHeadlines, markDoneInSource } from '../src/lib/org'
const [file, out, idx] = process.argv.slice(2)
const src = fs.readFileSync(file, 'utf8')
fs.writeFileSync(out, markDoneInSource(src, listHeadlines(src)[Number(idx)].path))`

server.registerTool(
  'emacs_oracle',
  {
    title: 'Compare Nest against real Emacs',
    description:
      'Marks a headline DONE in Nest and in a headless Emacs via org-todo, then byte ' +
      'compares. org-element.el is the only specification Org has, so Emacs is the ' +
      'oracle. This is the check that catches semantic bugs byte-fidelity cannot — ' +
      'repeaters, LAST_REPEAT, state resets. Cannot be faked; it shells out to emacs.',
    inputSchema: {
      file: z.string().describe('Path to an .org file, relative to the repo root.'),
      headline: z.number().int().min(0).default(0).describe('Zero-based headline index.'),
    },
  },
  async ({ file, headline }) => {
    const emacs = await sh('emacs', ['--version'])
    if (emacs.code !== 0) return text('SKIP: emacs not installed (apt install emacs-nox)')

    const src = path.resolve(ROOT, file)
    if (!src.startsWith(ROOT) && !src.startsWith(os.tmpdir())) {
      return text('REFUSED: file must be inside the repo or /tmp')
    }
    if (!fs.existsSync(src)) return text(`REFUSED: no such file: ${file}`)

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-oracle-'))
    const gen = path.join(ROOT, 'scripts', '.oracle-gen.ts')
    const el = path.join(dir, 'oracle.el')
    const nestOut = path.join(dir, 'nest.org')
    const emacsOut = path.join(dir, 'emacs.org')
    try {
      fs.writeFileSync(gen, GEN_TS)
      fs.writeFileSync(el, ORACLE_EL)
      const g = await sh('npx', ['vite-node', gen, '--', src, nestOut, String(headline)])
      if (!fs.existsSync(nestOut)) return text(`Nest generation failed:\n${g.out.slice(-2000)}`)
      const e = await sh('emacs', ['--batch', '-l', el, src, String(headline), emacsOut])
      if (!fs.existsSync(emacsOut)) return text(`Emacs run failed:\n${e.out.slice(-2000)}`)

      const a = fs.readFileSync(nestOut, 'utf8')
      const b = fs.readFileSync(emacsOut, 'utf8')
      if (a === b) return text(`ORACLE MATCH  ${file} headline ${headline}\nByte-identical to Emacs.`)
      const d = await sh('diff', ['-u', nestOut, emacsOut])
      return text(
        `ORACLE DIFF  ${file} headline ${headline}\n` +
          `Nest and Emacs disagree. Emacs is correct by definition.\n\n${d.out.slice(0, 4000)}`,
      )
    } finally {
      fs.rmSync(gen, { force: true })
      fs.rmSync(dir, { recursive: true, force: true })
    }
  },
)

/* --------------------------------------------------------------- handoff */
server.registerTool(
  'handoff_read',
  {
    title: 'Read HANDOFF.md',
    description:
      'The relay baton between agents. READ THIS FIRST, before any other action, ' +
      'so you do not rediscover the codebase or re-litigate settled decisions.',
    inputSchema: {},
  },
  async () =>
    text(fs.existsSync(HANDOFF) ? fs.readFileSync(HANDOFF, 'utf8') : 'HANDOFF.md does not exist yet.'),
)

server.registerTool(
  'handoff_write',
  {
    title: 'Replace HANDOFF.md',
    description:
      'WRITE THIS LAST, before you stop. Record: what you finished with commit SHAs, ' +
      'what is in progress, what is next, what must not be touched, and the gate and ' +
      'test status at handoff. Touches no source file.',
    inputSchema: { content: z.string().describe('Full replacement content for HANDOFF.md.') },
  },
  async ({ content }) => {
    fs.writeFileSync(HANDOFF, content.endsWith('\n') ? content : `${content}\n`)
    return text(`HANDOFF.md written (${content.length} bytes).`)
  },
)

await server.connect(new StdioServerTransport())
