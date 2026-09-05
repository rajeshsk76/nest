#!/usr/bin/env node
/**
 * Free a TCP port so Vite/Tauri can bind it. Best-effort across Linux tools.
 */
import { spawnSync } from "node:child_process"

const port = Number(process.argv[2] || process.env.NEST_DEV_PORT || 5173)

function tryRun(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" }
  } catch {
    return { status: null, stdout: "", stderr: "" }
  }
}

function pidsFromLsof() {
  const r = tryRun("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"])
  return r.stdout
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function pidsFromFuser() {
  const r = tryRun("fuser", [`${port}/tcp`])
  // fuser prints pids to stderr often
  const text = `${r.stdout} ${r.stderr}`
  return [...text.matchAll(/(\d+)/g)].map((m) => m[1])
}

function pidsFromSs() {
  const r = tryRun("ss", ["-ltnp", `sport = :${port}`])
  return [...r.stdout.matchAll(/pid=(\d+)/g)].map((m) => m[1])
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM")
    } catch {
      // ignore
    }
  }
  spawnSync("sleep", ["0.3"])
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 0)
      process.kill(Number(pid), "SIGKILL")
    } catch {
      // gone
    }
  }
}

tryRun("fuser", ["-k", `${port}/tcp`])
const pids = [...new Set([...pidsFromLsof(), ...pidsFromFuser(), ...pidsFromSs()])]
  .filter((pid) => pid && pid !== String(process.pid))

if (pids.length) {
  console.log(`[nest] freeing port ${port} (pids: ${pids.join(", ")})`)
  killPids(pids)
} else {
  console.log(`[nest] port ${port} looks free (or will be after fuser)`)
}

tryRun("fuser", ["-k", `${port}/tcp`])
spawnSync("sleep", ["0.2"])
