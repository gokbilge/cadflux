// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const allowlistPath = path.join(
  repoRoot,
  'tools',
  'minimization',
  'mlightcad-production-allowlist.json'
)
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))
const allowedPackages = new Map(
  allowlist.packages.map(item => [item.name, item])
)

const appRoots = ['apps/web', 'apps/server', 'apps/cli']
const productionPackageRoots = [
  'packages/cad-import',
  'packages/renderer-webgl',
  'packages/renderer-pdf',
  'packages/renderer-svg',
  'packages/drawing-model',
  'packages/plot-engine',
  'packages/diagnostics',
  'packages/presets',
  'packages/core',
  'packages/contracts',
  'packages/storage',
  'packages/database',
  'packages/batch-engine',
  'packages/file-ingest',
  'packages/dwg-adapter',
  'packages/dxf-adapter',
  'packages/auth',
  'packages/config'
]
const approvedImportRoots = new Set([
  path.resolve(repoRoot, 'packages/cad-import').split(path.sep).join('/'),
  path.resolve(repoRoot, 'packages/renderer-webgl').split(path.sep).join('/'),
  path.resolve(repoRoot, 'packages/cad-simple-viewer').split(path.sep).join('/'),
  path.resolve(repoRoot, 'packages/three-renderer').split(path.sep).join('/')
])

const forbiddenWorkspacePackages = new Set([
  '@mlightcad/cad-pdf-plugin',
  '@mlightcad/cad-svg-plugin',
  '@mlightcad/cad-agent-plugin',
  '@mlightcad/cad-html-plugin',
  '@mlightcad/cad-html-exporter-cli',
  '@mlightcad/cad-simple-ui-plugin',
  '@mlightcad/cad-viewer',
  '@mlightcad/cad-viewer-example',
  '@mlightcad/cad-simple-viewer-example',
  '@mlightcad/examples'
])

const directNodeRendererRoots = [
  'packages/renderer-pdf',
  'packages/renderer-svg',
  'apps/server',
  'apps/cli'
]

const violations = []

for (const root of appRoots) {
  scanRoot(root, { allowNoMlightcad: true })
}
for (const root of productionPackageRoots) {
  scanRoot(root, { allowApprovedOnly: true })
}
for (const root of directNodeRendererRoots) {
  forbidTokens(root, [
    '@mlightcad/cad-pdf-plugin',
    '@mlightcad/cad-svg-plugin'
  ])
}

checkManifests()
checkWorkspaceList()

if (violations.length > 0) {
  console.error('MLightCAD production check failed.')
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.importedPackage} — ${violation.reason}${violation.suggestedFacade ? `; use ${violation.suggestedFacade}` : ''}`
    )
  }
  process.exit(1)
}

console.log('MLightCAD production check passed.')

function scanRoot(relativeRoot, options) {
  const absoluteRoot = path.join(repoRoot, relativeRoot)
  if (!statExistsDirectory(absoluteRoot)) return
  walk(absoluteRoot, filePath => {
    const normalized = filePath.split(path.sep).join('/')
    const text = readFileSync(filePath, 'utf8')
    const matches = [...text.matchAll(/@mlightcad\/[A-Za-z0-9-./]+/g)].map(match => match[0])
    if (matches.length === 0) return

    for (const importedPackage of matches) {
      const rootPackage = importedPackage.split('/').slice(0, 2).join('/')
      const allowed = allowedPackages.has(rootPackage)
      const approvedRoot = [...approvedImportRoots].some(root => normalized.startsWith(`${root}/`) || normalized === root)

      if (options.allowNoMlightcad) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          importedPackage,
          reason: 'applications must not import @mlightcad/* directly',
          suggestedFacade: '@cadflux/cad-import or @cadflux/renderer-webgl'
        })
        continue
      }

      if (!options.allowApprovedOnly) continue

      if (!approvedRoot) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          importedPackage,
          reason: 'non-approved package imports MLightCAD directly',
          suggestedFacade: '@cadflux/cad-import or @cadflux/renderer-webgl'
        })
        continue
      }

      if (!allowed) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          importedPackage,
          reason: 'imported MLightCAD package is not in the production allowlist',
          suggestedFacade: '@cadflux/cad-import or @cadflux/renderer-webgl'
        })
      }
    }
  })
}

function forbidTokens(relativeRoot, tokens) {
  const absoluteRoot = path.join(repoRoot, relativeRoot)
  if (!statExistsDirectory(absoluteRoot)) return
  walk(absoluteRoot, filePath => {
    const text = readFileSync(filePath, 'utf8')
    for (const token of tokens) {
      if (text.includes(token)) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          importedPackage: token,
          reason: 'direct Node renderers and server conversion path must not depend on browser plugin packages',
          suggestedFacade: '@cadflux/renderer-pdf or @cadflux/renderer-svg'
        })
      }
    }
  })
}

function checkManifests() {
  for (const base of ['apps', 'packages']) {
    const basePath = path.join(repoRoot, base)
    if (!statExistsDirectory(basePath)) continue
    for (const entry of readdirSync(basePath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const manifestPath = path.join(basePath, entry.name, 'package.json')
      if (!existsSync(manifestPath)) continue
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const dependency of Object.keys(manifest[section] ?? {})) {
          if (!dependency.startsWith('@mlightcad/')) continue
          if (forbiddenWorkspacePackages.has(dependency)) {
            violations.push({
              file: path.relative(repoRoot, manifestPath),
              importedPackage: dependency,
              reason: `manifest declares forbidden MLightCAD package in ${section}`,
              suggestedFacade: '@cadflux/renderer-pdf, @cadflux/renderer-svg, or @cadflux/renderer-webgl'
            })
            continue
          }
          if (!allowedPackages.has(dependency)) {
            violations.push({
              file: path.relative(repoRoot, manifestPath),
              importedPackage: dependency,
              reason: `manifest declares non-allowlisted MLightCAD package in ${section}`,
              suggestedFacade: '@cadflux/cad-import or @cadflux/renderer-webgl'
            })
          }
        }
      }
    }
  }
}

function checkWorkspaceList() {
  const workspaceText = readFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
  for (const dependency of forbiddenWorkspacePackages) {
    const packageDir = dependency.replace('@mlightcad/', 'packages/')
    if (workspaceText.includes(packageDir)) {
      violations.push({
        file: 'pnpm-workspace.yaml',
        importedPackage: dependency,
        reason: 'example/editor/browser-export package remains in active workspace list',
        suggestedFacade: 'remove from active workspace list'
      })
    }
  }
}

function walk(directory, visitor) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue
      walk(nextPath, visitor)
      continue
    }
    if (!/\.(ts|tsx|mts|cts|vue|json)$/u.test(entry.name)) continue
    if (/\.(test|spec)\.(ts|tsx|mts|cts)$/u.test(entry.name)) continue
    visitor(nextPath)
  }
}

function statExistsDirectory(targetPath) {
  try {
    return statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}
