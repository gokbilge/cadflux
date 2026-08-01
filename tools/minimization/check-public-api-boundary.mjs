import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const packagesToCheck = [
  'packages/drawing-model',
  'packages/cad-import',
  'packages/plot-engine',
  'packages/diagnostics',
  'packages/contracts',
  'apps/server',
  'packages/storage',
  'packages/database'
]
const forbidden = ['@mlightcad/', 'three', 'vue']
const violations = []

for (const packagePath of packagesToCheck) {
  const srcDir = path.join(repoRoot, packagePath, 'src')
  walk(srcDir, packagePath)
}

if (violations.length > 0) {
  console.error('Public API boundary violations found:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`)
  }
  process.exit(1)
}

console.log('Public API boundary check passed.')

function walk(directory, packagePath) {
  if (!exists(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue
      walk(nextPath, packagePath)
      continue
    }
    if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue
    inspectFile(nextPath, packagePath)
  }
}

function inspectFile(filePath, packagePath) {
  const relative = path.relative(repoRoot, filePath)
  const text = readFileSync(filePath, 'utf8')
  const importMatches = text.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]+from\s+)?['"]([^'"]+)['"]/g
  )
  for (const match of importMatches) {
    const specifier = match[1]
    if (
      forbidden.some(item => specifier === item || specifier.startsWith(`${item}/`) || specifier === `${item}`)
    ) {
      violations.push({ file: relative, specifier, packagePath })
    }
  }
}

function exists(targetPath) {
  try {
    statSync(targetPath)
    return true
  } catch {
    return false
  }
}
