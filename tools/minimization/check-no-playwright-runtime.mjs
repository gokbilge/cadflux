// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const SEARCH_ROOTS = ['apps', 'packages']
const FORBIDDEN = [
  'playwright',
  'chromium',
  'browser.newPage',
  'page.evaluate'
]
const ALLOWED_FILES = new Set([
  'apps/server/src/conversion-transport-regression.test.ts',
  'docs/minimization/package-classification.md',
  'docs/minimization/playwright-usage.md',
  'tools/minimization/analyze-workspaces.mjs',
  'tools/minimization/measure-size.mjs',
  'tools/minimization/check-no-playwright-runtime.mjs'
])

const violations = []

for (const root of SEARCH_ROOTS) {
  const rootPath = path.join(ROOT, root)
  if (!existsSync(rootPath)) continue
  await walk(rootPath)
}

for (const manifestPath of [
  path.join(ROOT, 'package.json'),
  ...await collectPackageManifests(path.join(ROOT, 'apps')),
  ...await collectPackageManifests(path.join(ROOT, 'packages'))
]) {
  const relativePath = path.relative(ROOT, manifestPath).replace(/\\/g, '/')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (dependency === 'playwright' || dependency.includes('playwright')) {
        violations.push(`${relativePath}: forbidden manifest dependency ${dependency} in ${section}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Playwright runtime boundary check failed.')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('No Playwright runtime/build references found.')

async function walk(currentPath) {
  const entries = await readdir(currentPath, { withFileTypes: true })
  for (const entry of entries) {
    if (['dist', 'dist-runner', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue
    const fullPath = path.join(currentPath, entry.name)
    if (entry.isDirectory()) {
      await walk(fullPath)
      continue
    }
    if (!/\.(ts|tsx|js|mjs|cjs|json|md)$/u.test(entry.name)) continue
    const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, '/')
    if (ALLOWED_FILES.has(relativePath)) continue
    const source = await readFile(fullPath, 'utf8')
    for (const token of FORBIDDEN) {
      if (source.includes(token)) {
        violations.push(`${relativePath}: contains ${token}`)
      }
    }
  }
}

async function collectPackageManifests(basePath) {
  if (!existsSync(basePath)) return []
  const manifests = []
  const entries = await readdir(basePath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(basePath, entry.name, 'package.json')
    if (existsSync(manifestPath)) {
      manifests.push(manifestPath)
    }
  }
  return manifests
}
