// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync } from 'node:zlib'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const DIST_DIR = path.join(ROOT, 'apps', 'web', 'dist')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'minimization')

await mkdir(ARTIFACTS_DIR, { recursive: true })

if (!existsSync(DIST_DIR)) {
  throw new Error('apps/web/dist does not exist. Run the web analyze build first.')
}

const files = await collectFiles(DIST_DIR)
const assets = []
for (const file of files) {
  const buffer = await readFile(file)
  assets.push({
    path: path.relative(ROOT, file).replace(/\\/g, '/'),
    rawBytes: buffer.length,
    gzipBytes: gzipSync(buffer).length,
    brotliBytes: brotliCompressSync(buffer).length,
    kind: classifyAsset(file)
  })
}
const report = {
  generatedAt: new Date().toISOString(),
  assets: assets.sort((a, b) => b.rawBytes - a.rawBytes),
  totalRawBytes: assets.reduce((sum, item) => sum + item.rawBytes, 0)
}

await writeFile(path.join(ARTIFACTS_DIR, 'web-bundle-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'web-bundle-report.md'), renderMarkdown(report), 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'web-bundle-report.html'), renderHtml(report), 'utf8')

async function collectFiles(dir, output = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(fullPath, output)
    } else {
      output.push(fullPath)
    }
  }
  return output
}

function classifyAsset(file) {
  const normalized = file.replace(/\\/g, '/')
  if (normalized.endsWith('.js')) return 'javascript'
  if (normalized.endsWith('.css')) return 'css'
  if (normalized.endsWith('.wasm')) return 'wasm'
  if (/\.(woff2?|ttf|otf)$/u.test(normalized)) return 'font'
  if (/\.(map)$/u.test(normalized)) return 'source-map'
  return 'other'
}

function renderMarkdown(report) {
  return [
    '# Web bundle report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Total raw bytes: ${report.totalRawBytes}`,
    '',
    '| Asset | Kind | Raw bytes | Gzip bytes | Brotli bytes |',
    '| --- | --- | ---: | ---: | ---: |',
    ...report.assets.map(asset => `| ${asset.path} | ${asset.kind} | ${asset.rawBytes} | ${asset.gzipBytes} | ${asset.brotliBytes} |`)
  ].join('\n')
}

function renderHtml(report) {
  const rows = report.assets
    .map(
      asset => `<tr><td>${escapeHtml(asset.path)}</td><td>${asset.kind}</td><td>${asset.rawBytes}</td><td>${asset.gzipBytes}</td><td>${asset.brotliBytes}</td></tr>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CadFlux web bundle report</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 32px; color: #1f2a26; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d5d8d7; padding: 8px 10px; text-align: left; }
      th { background: #f3f5f4; }
      td:nth-child(n+3) { text-align: right; font-variant-numeric: tabular-nums; }
    </style>
  </head>
  <body>
    <h1>CadFlux web bundle report</h1>
    <p>Generated: ${escapeHtml(report.generatedAt)}</p>
    <p>Total raw bytes: ${report.totalRawBytes}</p>
    <table>
      <thead>
        <tr><th>Asset</th><th>Kind</th><th>Raw bytes</th><th>Gzip bytes</th><th>Brotli bytes</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
</html>`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
