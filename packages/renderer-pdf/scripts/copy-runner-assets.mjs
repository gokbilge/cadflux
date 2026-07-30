import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LIBREDWG_CONVERTER_PACKAGE,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_PACKAGE,
  MTEXT_RENDERER_WORKER_FILE
} from '../../../tools/worker-assets.mjs'

const require = createRequire(import.meta.url)
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(packageRoot, 'dist-runner')
const workersDir = join(outDir, 'workers')

function pkgRoot(name) {
  const entry = require.resolve(name)
  let dir = dirname(entry)
  while (true) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (pkg.name === name) {
        return dir
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`Package root not found: ${name}`)
    }
    dir = parent
  }
}

function copy(from, to) {
  if (!existsSync(from)) {
    throw new Error(`Missing asset: ${from}`)
  }
  copyFileSync(from, to)
}

function tryPkgRoot(name) {
  try {
    return pkgRoot(name)
  } catch {
    return null
  }
}

mkdirSync(workersDir, { recursive: true })

const libreDwgRoot = tryPkgRoot(LIBREDWG_CONVERTER_PACKAGE)
if (libreDwgRoot) {
  copy(
    join(libreDwgRoot, 'dist', LIBREDWG_PARSER_WORKER_FILE),
    join(workersDir, LIBREDWG_PARSER_WORKER_FILE)
  )
} else {
  console.warn(
    `Skipped optional worker copy because ${LIBREDWG_CONVERTER_PACKAGE} is unavailable.`
  )
}
const mtextRendererRoot = tryPkgRoot(MTEXT_RENDERER_PACKAGE)
if (mtextRendererRoot) {
  copy(
    join(mtextRendererRoot, 'dist', MTEXT_RENDERER_WORKER_FILE),
    join(workersDir, MTEXT_RENDERER_WORKER_FILE)
  )
} else {
  console.warn(
    `Skipped optional worker copy because ${MTEXT_RENDERER_PACKAGE} is unavailable.`
  )
}
