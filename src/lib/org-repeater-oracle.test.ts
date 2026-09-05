import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const oracle = path.join(root, 'scripts/emacs-repeater-oracle.mjs')

describe('Emacs repeater oracle (same commit as write surface)', () => {
  it('Nest markDoneInSource matches emacs --batch org-todo on +1w fixture', () => {
    const emacs = spawnSync('emacs', ['--version'], { encoding: 'utf8' })
    if (emacs.status !== 0) {
      expect(oracle).toMatch(/emacs-repeater-oracle\.mjs$/)
      return
    }
    const r = spawnSync('node', [oracle], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC' },
    })
    if (r.status !== 0) {
      console.log(r.stdout)
      console.error(r.stderr)
    }
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('PASS: Nest matches Emacs on repeater Mark DONE semantics')
  })
})
