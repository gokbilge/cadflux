// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = process.cwd()
const scriptName = process.argv[2]

if (!scriptName) {
  throw new Error('Usage: node tools/run-workspace-script.mjs <script-name>')
}

const workspaceText = readFileSync(
  path.join(repoRoot, 'pnpm-workspace.yaml'),
  'utf8'
)
const workspaces = [...workspaceText.matchAll(/-\s+'([^']+)'/g)]
  .map(match => match[1])
  .map(relativeDir => {
    const packageJsonPath = path.join(repoRoot, relativeDir, 'package.json')
    if (!existsSync(packageJsonPath)) {
      return null
    }
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    if (!manifest.scripts?.[scriptName]) {
      return null
    }
    return {
      name: manifest.name ?? relativeDir,
      cwd: path.join(repoRoot, relativeDir)
    }
  })
  .filter(Boolean)

for (const workspace of workspaces) {
  console.log(`> ${workspace.name}:${scriptName}`)
  await runPnpmScript(workspace.cwd, scriptName)
}

async function runPnpmScript(cwd, name) {
  await new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', `pnpm run ${name}`], {
            cwd,
            stdio: 'inherit',
            env: process.env
          })
        : spawn('pnpm', ['run', name], {
            cwd,
            stdio: 'inherit',
            env: process.env
          })

    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Script ${name} failed in ${cwd}`))
    })
  })
}
