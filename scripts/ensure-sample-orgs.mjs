#!/usr/bin/env node
/**
 * Ensure sample .org files exist under data/ and public/ for first launch.
 * Idempotent: never overwrites existing non-empty files.
 */
import { mkdir, readFile, writeFile, access, constants } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  {
    fixture: 'src/fixtures/inbox.org',
    targets: ['data/sample-inbox.org', 'public/sample-inbox.org'],
  },
  {
    fixture: 'src/fixtures/projects.org',
    targets: ['data/projects.org', 'public/projects.org'],
  },
]

async function existsNonEmpty(path) {
  try {
    await access(path, constants.F_OK)
    const content = await readFile(path, 'utf8')
    return content.trim().length > 0
  } catch {
    return false
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function main() {
  await ensureDir(join(root, 'data'))
  await ensureDir(join(root, 'public'))

  for (const { fixture, targets } of FILES) {
    const seedPath = join(root, fixture)
    let seed
    try {
      seed = await readFile(seedPath, 'utf8')
    } catch (err) {
      console.error(`[ensure-sample-orgs] missing fixture: ${fixture}`)
      throw err
    }

    for (const rel of targets) {
      const dest = join(root, rel)
      if (await existsNonEmpty(dest)) {
        console.log(`[ensure-sample-orgs] keep existing ${rel}`)
        continue
      }
      await ensureDir(dirname(dest))
      await writeFile(dest, seed, 'utf8')
      console.log(`[ensure-sample-orgs] wrote ${rel}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
