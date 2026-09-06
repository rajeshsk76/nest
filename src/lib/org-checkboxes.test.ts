import { describe, expect, it } from 'vitest'
import { assertOnlySpansChanged, RefuseWrite } from './org-core'
import { listCheckboxes, toggleCheckboxInSource } from './org-checkboxes'

describe('listCheckboxes', () => {
  it('lists checkbox items in document order with index, cookie and hasChildren', () => {
    const src = `* Project [0/1]
- [ ] Parent [0/1]
  - [ ] Child [1/2]
    - [X] One
    - [ ] Two
`
    const items = listCheckboxes(src)
    expect(items.map((i) => [i.text, i.checkbox, i.cookie, i.hasChildren])).toEqual([
      ['Parent', 'off', '[0/1]', true],
      ['Child', 'off', '[1/2]', true],
      ['One', 'on', null, false],
      ['Two', 'off', null, false],
    ])
    expect(items.every((i) => i.headlinePath && i.headlinePath[0] === 0)).toBe(true)
  })
})

describe('toggleCheckboxInSource: leaf toggling', () => {
  it('flips an unchecked leaf to checked', () => {
    const src = '- [ ] Buy milk\n'
    const result = toggleCheckboxInSource(src, 0)
    expect(result.next).toBe('- [X] Buy milk\n')
    assertOnlySpansChanged(src, result.next, result.edits)
  })

  it('flips a checked leaf back to unchecked', () => {
    const src = '- [X] Buy milk\n'
    const result = toggleCheckboxInSource(src, 0)
    expect(result.next).toBe('- [ ] Buy milk\n')
    assertOnlySpansChanged(src, result.next, result.edits)
  })

  it('refuses an out-of-range index', () => {
    const src = '- [ ] Buy milk\n'
    expect(() => toggleCheckboxInSource(src, 5)).toThrow(RefuseWrite)
  })
})

describe('toggleCheckboxInSource: the four rules', () => {
  const src = `* Project [0/1]
- [ ] Parent [0/1]
  - [ ] Child [1/2]
    - [X] One
    - [ ] Two
`

  it('rule 1 + 2: toggling a leaf propagates up, [X] only when every direct child is checked', () => {
    const idx = listCheckboxes(src).findIndex((i) => i.text === 'Two')
    const result = toggleCheckboxInSource(src, idx)
    expect(result.next).toBe(`* Project [1/1]
- [X] Parent [1/1]
  - [X] Child [2/2]
    - [X] One
    - [X] Two
`)
  })

  it('rule 2: a mixed set of direct children produces [-], not [X]', () => {
    // Toggle "One" off instead — Child then has one on (Two started off... wait Two is off,
    // One is on) so toggling One off leaves both direct children of Child off: still [ ].
    // Use a source where toggling produces a genuine partial state instead.
    const partial = `* Project [0/1]
- [ ] Parent [0/1]
  - [ ] Child [0/2]
    - [ ] One
    - [ ] Two
`
    const idx = listCheckboxes(partial).findIndex((i) => i.text === 'One')
    const result = toggleCheckboxInSource(partial, idx)
    expect(result.next).toBe(`* Project [0/1]
- [-] Parent [0/1]
  - [-] Child [1/2]
    - [X] One
    - [ ] Two
`)
  })

  it('rule 3: toggling a parent whose state is derived from children refuses', () => {
    const idx = listCheckboxes(src).findIndex((i) => i.text === 'Parent')
    expect(() => toggleCheckboxInSource(src, idx)).toThrow(RefuseWrite)
    const childIdx = listCheckboxes(src).findIndex((i) => i.text === 'Child')
    expect(() => toggleCheckboxInSource(src, childIdx)).toThrow(RefuseWrite)
  })

  it('rule 4: a headline cookie works with no list cookie present anywhere below it', () => {
    const noListCookies = `* Project [0/1]
- [ ] Parent
  - [ ] Child
    - [X] One
    - [ ] Two
`
    const idx = listCheckboxes(noListCookies).findIndex((i) => i.text === 'Two')
    const result = toggleCheckboxInSource(noListCookies, idx)
    expect(result.next).toBe(`* Project [1/1]
- [X] Parent
  - [X] Child
    - [X] One
    - [X] Two
`)
  })

  it('does not normalise resting state it was not asked to touch', () => {
    // Child starts inconsistent: [ ] with one of its two children already
    // checked — a state Emacs tolerates but would not have produced.
    // Toggling the *other* grandchild ("Two") must only touch the path from
    // Two up to the root; it must not "fix" Child's pre-existing box beyond
    // what that path's own recompute naturally produces.
    const inconsistent = `* Project [0/1]
- [ ] Parent [0/1]
  - [ ] Child [1/2]
    - [X] One
    - [ ] Two
`
    const idx = listCheckboxes(inconsistent).findIndex((i) => i.text === 'Two')
    const result = toggleCheckboxInSource(inconsistent, idx)
    // Child recomputes to [2/2] / [X] purely because both its real children
    // (One, Two) are now checked — not because of any separate "fix" pass.
    expect(result.next).toContain('- [X] Child [2/2]')
  })
})

describe('toggleCheckboxInSource: statistics cookies', () => {
  it('recalculates a [/] fraction cookie', () => {
    const src = `- [ ] Parent [0/2]
  - [ ] A
  - [ ] B
`
    const idx = listCheckboxes(src).findIndex((i) => i.text === 'A')
    const result = toggleCheckboxInSource(src, idx)
    expect(result.next).toContain('[1/2]')
  })

  it('recalculates a [%] percentage cookie', () => {
    const src = `- [ ] Parent [0%]
  - [ ] A
  - [ ] B
`
    const idx = listCheckboxes(src).findIndex((i) => i.text === 'A')
    const result = toggleCheckboxInSource(src, idx)
    expect(result.next).toContain('[50%]')
  })
})

describe('toggleCheckboxInSource: declared spans and byte fidelity', () => {
  it('declares exactly the spans it touched and nothing else moves', () => {
    const src = `* Project [0/1]
:PROPERTIES:
:CLIENT: café
:END:

#+BEGIN_SRC python :tangle build.py
print("hello")
#+END_SRC

#+NAME: checklist
#+CAPTION: A checklist with unrelated syntax around it
- [ ] Parent [0/1]
  - [ ] Child [1/2]
    - [X] One
    - [ ] Two
`
    const idx = listCheckboxes(src).findIndex((i) => i.text === 'Two')
    const result = toggleCheckboxInSource(src, idx)

    assertOnlySpansChanged(src, result.next, result.edits)
    expect(result.next).toContain(':CLIENT: café')
    expect(result.next).toContain('#+BEGIN_SRC python :tangle build.py')
    expect(result.next).toContain('print("hello")')
    expect(result.next).toContain('#+NAME: checklist')
    expect(result.next).toContain('#+CAPTION: A checklist with unrelated syntax around it')
    expect(result.next).toContain('* Project [1/1]')
  })

  it('refuses (via the declared-span guard) a result that moved a byte outside its declared edits', () => {
    const src = '- [ ] Buy milk\n'
    const result = toggleCheckboxInSource(src, 0)
    const tampered = result.next + '\n'
    expect(() => assertOnlySpansChanged(src, tampered, result.edits)).toThrow(RefuseWrite)
  })
})
