import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const files = await readdir('dist/assets')
const assets = files.map(name => '/assets/' + name)
const source = await readFile('dist/sw.js', 'utf8')
const hash = createHash('sha256').update(source + assets.join(',')).digest('hex').slice(0, 12)
await writeFile('dist/sw.js', source.replace('__BUILD__', hash).replace('/* BUILD_ASSETS */', assets.map(a => JSON.stringify(a)).join(', ')))
