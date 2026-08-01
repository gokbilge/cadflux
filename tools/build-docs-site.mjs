// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const docsDir = path.join(repoRoot, 'docs')
const outputFile = path.join(docsDir, 'index.html')

const markdownFiles = []
for (const entry of await readdir(docsDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) {
    markdownFiles.push(entry.name)
  }
}
markdownFiles.sort()

const items = []
for (const fileName of markdownFiles) {
  const fullPath = path.join(docsDir, fileName)
  const source = await readFile(fullPath, 'utf8')
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fileName
  items.push({ fileName, title })
}

await mkdir(docsDir, { recursive: true })
await writeFile(
  outputFile,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CadFlux documentation</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 40px; color: #1f2a26; }
      main { max-width: 960px; }
      h1 { margin-bottom: 0.5rem; }
      ul { padding-left: 1.2rem; }
      li { margin: 0.35rem 0; }
      a { color: #0d5bd1; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .muted { color: #5f6b66; }
    </style>
  </head>
  <body>
    <main>
      <h1>CadFlux documentation</h1>
      <p class="muted">Static documentation index generated without Typedoc.</p>
      <ul>
        ${items.map(item => `<li><a href="./${item.fileName}">${escapeHtml(item.title)}</a></li>`).join('\n        ')}
      </ul>
    </main>
  </body>
</html>
`,
  'utf8'
)

if (existsSync(path.join(repoRoot, 'tools', 'prepare-docs-site.mjs'))) {
  await import('./prepare-docs-site.mjs')
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
