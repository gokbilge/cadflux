import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const workspaceRoots = ['apps', 'packages']
const tscBinPath = path.join(
  repoRoot,
  'node_modules',
  'typescript',
  'bin',
  'tsc'
)
const tsconfigPaths = []

for (const workspaceRoot of workspaceRoots) {
  const absoluteWorkspaceRoot = path.join(repoRoot, workspaceRoot)
  for (const entry of readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const tsconfigPath = path.join(absoluteWorkspaceRoot, entry.name, 'tsconfig.json')
    if (existsSync(tsconfigPath)) {
      tsconfigPaths.push(tsconfigPath)
    }
  }
}

for (const tsconfigPath of tsconfigPaths) {
  await runTypecheck(tsconfigPath)
}

async function runTypecheck(tsconfigPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tscBinPath, '-p', tsconfigPath, '--noEmit'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=4096'
        },
        stdio: 'inherit'
      }
    )

    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Typecheck failed for ${tsconfigPath}`))
    })
  })
}
