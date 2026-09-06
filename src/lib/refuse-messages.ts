import { RefuseWrite } from './org-core'

/**
 * Map RefuseWrite / status refuse paths to calm plain English for the UI.
 * Technical detail stays in console via the caller.
 */
export function plainRefuseMessage(err: RefuseWrite): string {
  const m = err.message

  if (/unrecognised timestamp/i.test(m) || /^unsupported repeater/i.test(m)) {
    return "Nest didn't recognise that date format, so it left the file alone."
  }
  if (/overlapping edits/i.test(m)) {
    return "Nest couldn't apply overlapping edits, so it left the file alone."
  }
  if (/edit span out of range/i.test(m)) {
    return "Nest couldn't find a safe place for that edit, so it left the file alone."
  }
  if (/title contains a newline/i.test(m)) {
    return "Titles can't contain a line break, so Nest left the file alone."
  }
  if (/table cell contains a pipe/i.test(m)) {
    return "Table cells can't contain a pipe character, so Nest left the file alone."
  }
  if (/table cell contains a newline/i.test(m)) {
    return "Table cells can't contain a line break, so Nest left the file alone."
  }
  if (/cannot edit table rule/i.test(m)) {
    return "Nest doesn't edit table separator rows, so it left the file alone."
  }
  if (/table (row|column) out of range|table not found/i.test(m)) {
    return "Nest couldn't find that table cell, so it left the file alone."
  }
  if (/cannot promote level-1/i.test(m)) {
    return "That headline is already at the top level, so Nest left the file alone."
  }
  if (/src body contains an #\+END_SRC/i.test(m)) {
    return "That source body would break the Org fence, so Nest left the file alone."
  }
  if (/headline path not found|parent section not found|empty headline path/i.test(m)) {
    return "Nest couldn't find that headline, so it left the file alone."
  }
  if (/unrecognised tag region/i.test(m)) {
    return "Nest couldn't update those tags safely, so it left the file alone."
  }
  if (/no source position/i.test(m) || /unrecognised headline shape/i.test(m)) {
    return "Nest couldn't locate that spot in the file, so it left it alone."
  }
  if (/PROPERTIES drawer without/i.test(m) || /unrecognised LAST_REPEAT/i.test(m)) {
    return "Nest couldn't update the properties drawer safely, so it left the file alone."
  }
  if (/repeater \+\+ overflow/i.test(m)) {
    return "Nest stopped advancing that repeater to keep the file safe."
  }
  if (/overlapping sibling|non-section bytes between siblings/i.test(m)) {
    return "Nest couldn't move that subtree safely, so it left the file alone."
  }
  if (/cannot toggle a checkbox whose state is derived from its children/i.test(m)) {
    return "That box follows its own items automatically, so Nest left it alone."
  }
  if (/cannot toggle a checkbox in a mixed state/i.test(m)) {
    return "Nest doesn't know how to toggle that box from a mixed state, so it left the file alone."
  }
  if (/checkbox index out of range|checkbox marker not found/i.test(m)) {
    return "Nest couldn't find that checkbox, so it left the file alone."
  }

  return "Nest couldn't make that edit safely, so it left the file alone."
}

export function plainRegionsRefuseMessage(fileId: string, regions: number): string {
  return `Nest skipped that edit because it would change ${regions} separate parts of ${fileId}.org.`
}
