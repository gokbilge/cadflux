import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const roots = ['apps', 'packages']
const violations = []
const patterns = [
  { label: 'vue-i18n', regex: /['"]vue-i18n['"]/g },
  { label: 'useI18n', regex: /\buseI18n\b/g },
  { label: 'createI18n', regex: /\bcreateI18n\b/g },
  { label: '$t(', regex: /\$t\(/g },
  { label: 'i18n.global', regex: /\bi18n\.global\b/g },
  { label: '@intlify', regex: /@intlify\//g }
]

for (const root of roots) {
  walk(path.join(repoRoot, root))
}

if (violations.length > 0) {
  console.error('i18n runtime/build references found:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.label}`)
  }
  process.exit(1)
}

console.log('No i18n runtime/build references found.')

function walk(directory) {
  if (!exists(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['dist', 'dist-runner', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue
      walk(nextPath)
      continue
    }
    if (!/\.(ts|tsx|vue|js|mjs|cjs|json)$/.test(entry.name)) continue
    inspectFile(nextPath)
  }
}

function inspectFile(filePath) {
  const text = readFileSync(filePath, 'utf8')
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      violations.push({
        file: path.relative(repoRoot, filePath),
        label: pattern.label
      })
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
