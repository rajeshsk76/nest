#!/usr/bin/env node
/**
 * Stable Vite dev launcher: bind 0.0.0.0:5173 and auto-restart on unexpected exit.
 */
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const PORT = 5173
const RESTART_DELAY_MS = 800
const VITE_ARGS = ["--host", "0.0.0.0", "--port", String(PORT), "--strictPort"]

let stopping = false
let child = null

function resolveViteBin() {
  const candidates = [
    join(root, "node_modules", "vite", "bin", "vite.js"),
    join(root, "node_modules", ".bin", "vite"),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error("Could not find local Vite binary under node_modules")
}

async function freePort() {
  // Best-effort: kill stale listeners on 5173 (Linux).
  try {
    await new Promise((resolve) => {
      const killer = spawn("fuser", ["-k", `${PORT}/tcp`], {
        stdio: "ignore",
      })
      killer.on("error", () => resolve())
      killer.on("exit", () => resolve())
    })
    await delay(200)
  } catch {
    // ignore
  }
}

function startVite() {
  const viteBin = resolveViteBin()
  const args = viteBin.endsWith(".js")
    ? [viteBin, ...VITE_ARGS]
    : [...VITE_ARGS]
  const cmd = viteBin.endsWith(".js") ? process.execPath : viteBin
  child = spawn(cmd, args, {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  })

  child.on("exit", (code, signal) => {
    child = null
    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0))
      return
    }
    const unexpected = code !== 0 || signal
    if (!unexpected) {
      process.exit(0)
      return
    }
    const reason = signal ? `signal ${signal}` : `exit code ${code}`
    console.error(
      `[dev] Vite exited unexpectedly (${reason}); restarting in ${RESTART_DELAY_MS}ms…`,
    )
    setTimeout(() => {
      if (stopping) return
      startVite()
    }, RESTART_DELAY_MS)
  })
}

function requestStop(signal) {
  if (stopping) return
  stopping = true
  console.log(`[dev] received ${signal}; shutting down`)
  if (child && !child.killed) {
    child.kill(signal)
  } else {
    process.exit(0)
  }
}

process.on("SIGINT", () => requestStop("SIGINT"))
process.on("SIGTERM", () => requestStop("SIGTERM"))

await freePort()
startVite()
