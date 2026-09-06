#!/usr/bin/env node
/**
 * Point this repo's Git hooks at .githooks/ (committed pre-commit gate).
 * Invoked by prepare so install enables hooks locally.
 * No-ops outside a git working tree (e.g. pack / CI checkout without .git).
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hooksPath = join(root, '.githooks')
const gitDir = join(root, '.git')

if (!existsSync(gitDir)) {
  process.exit(0)
}

if (!existsSync(hooksPath)) {
  console.warn('install-git-hooks: .githooks missing; skipping')
  process.exit(0)
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: root,
    stdio: 'inherit',
  })
} catch (err) {
  console.warn(
    'install-git-hooks: could not set core.hooksPath (non-fatal):',
    err instanceof Error ? err.message : err,
  )
  process.exit(0)
}
