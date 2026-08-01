// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = process.cwd()
const scriptName = process.argv[2]

if (!scriptName) {
  throw new Error('Usage: node tools/run-workspace-script.mjs <script-name>')
}

const workspaceRoots = ['apps', 'packages']
const workspaces = []

for (const workspaceRoot of workspaceRoots) {
  const absoluteRoot = path.join(repoRoot, workspaceRoot)
  for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const packageJsonPath = path.join(absoluteRoot, entry.name, 'package.json')
    if (!existsSync(packageJsonPath)) {
      continue
    }
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    if (manifest.scripts?.[scriptName]) {
      workspaces.push({
        name: manifest.name ?? `${workspaceRoot}/${entry.name}`,
        cwd: path.join(absoluteRoot, entry.name)
      })
    }
  }
}

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
