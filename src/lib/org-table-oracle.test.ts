import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const oracle = path.join(root, 'scripts/emacs-table-oracle.mjs')

describe('Emacs table numeric-align oracle (same commit as write surface)', () => {
  it('Nest updateTableCellInSource matches emacs --batch org-table-align on numeric Qty', () => {
    const emacs = spawnSync('emacs', ['--version'], { encoding: 'utf8' })
    if (emacs.status !== 0) {
      expect(oracle).toMatch(/emacs-table-oracle\.mjs$/)
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
    expect(r.stdout).toContain('PASS: Nest matches Emacs on numeric table cell edit alignment')
  })
})
