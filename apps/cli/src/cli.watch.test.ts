// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

const TEMP_ROOTS: string[] = []

afterEach(async () => {
  while (TEMP_ROOTS.length > 0) {
    const tempRoot = TEMP_ROOTS.pop()
    if (!tempRoot) {
      continue
    }
    await rm(tempRoot, { recursive: true, force: true })
  }
})

test('watch retries a transient failure and archives the source after success', async () => {
  const tempRoot = await createTempRoot()
  const inputDir = path.join(tempRoot, 'incoming')
  const outputDir = path.join(tempRoot, 'output')
  const archiveDir = path.join(tempRoot, 'archive')
  await mkdir(inputDir, { recursive: true })
  await writeFile(path.join(inputDir, 'retry-fail-once.dxf'), '0\nEOF\n', 'utf8')

  const child = startWatchProcess([
    inputDir,
    '--output',
    outputDir,
    '--interval',
    '100',
    '--debounce-ms',
    '100',
    '--retry-delay-ms',
    '100',
    '--max-retries',
    '2',
    '--archive-success',
    archiveDir,
    '--log-format',
    'json'
  ])

  try {
    await waitForPath(path.join(outputDir, 'retry-fail-once.pdf'))
    await waitForPath(path.join(archiveDir, 'retry-fail-once.dxf'))
    const ledger = JSON.parse(
      await readFile(path.join(outputDir, '.cadflux', 'watch-ledger.json'), 'utf8')
    ) as Record<string, { status: string; attempts: number }>
    const ledgerEntry = ledger[path.join(inputDir, 'retry-fail-once.dxf')]
    assert.ok(ledgerEntry)
    assert.equal(ledgerEntry.status, 'completed')
    assert.equal(ledgerEntry.attempts, 2)
  } finally {
    stopWatchProcess(child)
  }
})

test('watch quarantines a permanent failure after max retries', async () => {
  const tempRoot = await createTempRoot()
  const inputDir = path.join(tempRoot, 'incoming')
  const outputDir = path.join(tempRoot, 'output')
  const quarantineDir = path.join(tempRoot, 'quarantine')
  await mkdir(inputDir, { recursive: true })
  await writeFile(path.join(inputDir, 'broken-fail-always.dxf'), '0\nEOF\n', 'utf8')

  const child = startWatchProcess([
    inputDir,
    '--output',
    outputDir,
    '--interval',
    '100',
    '--debounce-ms',
    '100',
    '--retry-delay-ms',
    '100',
    '--max-retries',
    '2',
    '--quarantine-failures',
    quarantineDir,
    '--log-format',
    'json'
  ])

  try {
    await waitForPath(path.join(quarantineDir, 'broken-fail-always.dxf'))
    const ledger = JSON.parse(
      await readFile(path.join(outputDir, '.cadflux', 'watch-ledger.json'), 'utf8')
    ) as Record<string, { status: string; attempts: number }>
    const ledgerEntry = ledger[path.join(inputDir, 'broken-fail-always.dxf')]
    assert.ok(ledgerEntry)
    assert.equal(ledgerEntry.status, 'failed')
    assert.equal(ledgerEntry.attempts, 2)
  } finally {
    stopWatchProcess(child)
  }
})

test('watch rejects an output directory nested under the watched input directory', async () => {
  const tempRoot = await createTempRoot()
  const inputDir = path.join(tempRoot, 'incoming')
  const nestedOutputDir = path.join(inputDir, 'output')
  await mkdir(inputDir, { recursive: true })

  const result = await runWatchProcessToExit([
    inputDir,
    '--output',
    nestedOutputDir,
    '--interval',
    '100',
    '--debounce-ms',
    '100',
    '--retry-delay-ms',
    '100',
    '--max-retries',
    '2'
  ])

  assert.notEqual(result.exitCode, 0)
  assert.match(
    result.stderr,
    /Watch output directory cannot be inside the watched input directory\./
  )
})

async function createTempRoot(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cadflux-watch-test-'))
  TEMP_ROOTS.push(tempRoot)
  return tempRoot
}

function startWatchProcess(args: string[]): ChildProcessWithoutNullStreams {
  const cliPath = path.resolve('dist/apps/cli/src/cli.js')
  return spawn(process.execPath, [cliPath, 'watch', ...args], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      CADFLUX_CLI_WATCH_TEST_MODE: '1'
    },
    stdio: 'pipe'
  })
}

async function runWatchProcessToExit(args: string[]): Promise<{
  exitCode: number | null
  stdout: string
  stderr: string
}> {
  const child = startWatchProcess(args)
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', chunk => {
    stderr += chunk.toString()
  })

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code))
  })

  return { exitCode, stdout, stderr }
}

function stopWatchProcess(child: ChildProcessWithoutNullStreams) {
  if (child.killed) {
    return
  }
  child.kill('SIGINT')
}

async function waitForPath(targetPath: string, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await readFile(targetPath)
      return
    } catch {
      await delay(100)
    }
  }
  throw new Error(`Timed out waiting for ${targetPath}`)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
