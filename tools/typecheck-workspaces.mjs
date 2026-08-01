import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const workspaceConfigPath = path.join(repoRoot, 'pnpm-workspace.yaml')
const tscBinPath = path.join(
  repoRoot,
  'node_modules',
  'typescript',
  'bin',
  'tsc'
)
const tsconfigPaths = []

for (const relativeWorkspaceDir of readActiveWorkspaceDirs(workspaceConfigPath)) {
  const tsconfigPath = path.join(repoRoot, relativeWorkspaceDir, 'tsconfig.json')
  if (existsSync(tsconfigPath)) {
    tsconfigPaths.push(tsconfigPath)
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

function readActiveWorkspaceDirs(configPath) {
  const source = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
  return source
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line.startsWith("- '") && !line.startsWith("- '!"))
    .map(line => line.slice(3, -1))
}
