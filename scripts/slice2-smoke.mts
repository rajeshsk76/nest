import { demoteSubtreeInSource, insertHeadingInSource, listHeadlines, moveSubtreeInSource, promoteSubtreeInSource, parseOrg } from './src/lib/org.ts'
import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync('./src/fixtures/projects.org', 'utf8')
const headlines = listHeadlines(src, 'projects')
const personal = headlines.find(h => h.title === 'Personal')
let out = moveSubtreeInSource(src, personal.path, 'up')
const polish = listHeadlines(out, 'projects').find(h => h.title === 'Polish Today view')
out = demoteSubtreeInSource(out, polish.path)
const demoted = listHeadlines(out, 'projects').find(h => h.title === 'Polish Today view')
out = promoteSubtreeInSource(out, demoted.path)
const nest2 = listHeadlines(out, 'projects').find(h => h.title === 'Nest')
out = insertHeadingInSource(out, nest2.path, 'Slice 2 smoke peer')
writeFileSync('./data/slice2-smoke.org', out)
for (const h of listHeadlines(out, 's')) console.log('*'.repeat(h.level), h.title)
parseOrg(out)
console.log('parse ok, bytes', out.length)

