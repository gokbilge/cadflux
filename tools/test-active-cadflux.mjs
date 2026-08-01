// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { spawnSync } from 'node:child_process'

const nodeExecutable = process.execPath
const commands = [
  [
    nodeExecutable,
    [
      '--experimental-vm-modules',
      './node_modules/jest/bin/jest.js',
      '--runInBand',
      'apps/server/src/server.test.ts',
      'apps/server/src/conversion-transport-regression.test.ts',
      'packages/database/src/index.test.ts',
      'packages/drawing-model/src/index.test.ts',
      'packages/cad-import/src/index.test.ts',
      'packages/renderer-pdf/src/node.test.ts',
      'packages/renderer-svg/src/node.test.ts'
    ]
  ],
  [nodeExecutable, ['./tools/test-cadflux-server.mjs']]
]

for (const [command, args] of commands) {
  const run = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    cwd: process.cwd()
  })
  if (run.error) {
    console.error(`Failed to start command: ${command} ${args.join(' ')}`)
    console.error(run.error)
    process.exit(1)
  }
  if (run.status !== 0) {
    process.exit(run.status ?? 1)
  }
}
