import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const allowlistPath = path.join(
  repoRoot,
  'tools',
  'minimization',
  'mlightcad-import-allowlist.json'
)
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))
const allowedRoots = new Set(
  allowlist.allowedPackages.map(item =>
    path.resolve(repoRoot, item).split(path.sep).join('/')
  )
)

const productionRoots = [
  'apps/web',
  'apps/server',
  'apps/cli',
  'packages/renderer-webgl',
  'packages/renderer-svg',
  'packages/renderer-pdf',
  'packages/plot-engine',
  'packages/diagnostics',
  'packages/presets',
  'packages/drawing-model',
  'packages/dwg-adapter',
  'packages/dxf-adapter',
  'packages/cad-import'
]

const violations = []

for (const root of productionRoots) {
  const absoluteRoot = path.join(repoRoot, root)
  walk(absoluteRoot)
}

if (violations.length > 0) {
  console.error('MLightCAD boundary violations found:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.importPath}`)
  }
  process.exit(1)
}

console.log('MLightCAD boundary check passed.')

function walk(directory) {
  if (!statExists(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue
      walk(nextPath)
      continue
    }
    if (!/\.(ts|vue|tsx|mts|cts)$/.test(entry.name)) continue
    if (/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(entry.name)) continue
    inspectFile(nextPath)
  }
}

function inspectFile(filePath) {
  const normalized = filePath.split(path.sep).join('/')
  if (isAllowed(normalized)) return
  const text = readFileSync(filePath, 'utf8')
  const matches = text.matchAll(/@mlightcad\/[A-Za-z0-9-./]+/g)
  for (const match of matches) {
    violations.push({
      file: path.relative(repoRoot, filePath),
      importPath: match[0]
    })
  }
}

function isAllowed(normalizedFilePath) {
  for (const allowedRoot of allowedRoots) {
    if (
      normalizedFilePath === allowedRoot ||
      normalizedFilePath.startsWith(`${allowedRoot}/`)
    ) {
      return true
    }
  }
  return false
}

function statExists(targetPath) {
  try {
    return statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}
