import type { Headline, OrgData, OrgNode, Planning, Timestamp } from 'uniorg'
// TEMP partial — will be replaced with full Track A.1a org-core.ts
export function stampHasRepeater(raw: string | null | undefined): boolean { return !!raw && /([.+])?\+(\d+)([hdwmy])/.test(raw) }
export function advanceRepeaterTimestamp(raw: string, _now = new Date()): string { return raw }
export function markDoneInSource(source: string, _path: number[], _options: { now?: Date } = {}): string { return source }
export const LAST_REPEAT = 'LAST_REPEAT'
