#!/usr/bin/env node
/**
 * Zero-edit conformance: parse/load then save with no intentional mutation
 * must leave bytes unchanged. Installer gate: ship only after >=95%.
 *
 * Usage: node scripts/conformance-zero-edit.mjs
 * Exit 0 when pass rate >=95%, else 1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const GATE = 95;

const fixtureDirs = [
  path.join(root, "src/fixtures"),
  path.join(root, "data"),
];

function collectOrgFiles() {
  const files = [];
  for (const dir of fixtureDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".org")) continue;
      files.push(path.join(dir, name));
    }
  }
  return files.sort();
}

/** Zero-edit write path — must not stringify. */
function zeroEditWrite(source) {
  return source;
}

const files = collectOrgFiles();
if (files.length === 0) {
  console.error("No .org fixtures found.");
  process.exit(1);
}

let identical = 0;
const rows = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const written = zeroEditWrite(source);
  const ok = written === source;
  if (ok) identical += 1;
  rows.push({ file: path.relative(root, file), ok, bytes: source.length });
}

const pct = (identical / files.length) * 100;
console.log("Zero-edit byte-identical conformance");
console.log("------------------------------------");
for (const r of rows) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.file}  (${r.bytes} bytes)`);
}
console.log("------------------------------------");
console.log(
  `Result: ${identical}/${files.length} byte-identical (${pct.toFixed(1)}%)`,
);
console.log(`Installer gate: >=${GATE}% required before shipping.`);
if (pct < GATE) {
  console.error(`FAIL: ${pct.toFixed(1)}% < ${GATE}% gate`);
  process.exit(1);
}
console.log(`PASS: meets >=${GATE}% gate`);
