// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { mkdtempSync } from 'node:fs'

import { resolveContainedPath, startLocalConversionBridge } from './browserBridge'

describe('resolveContainedPath', () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'cadflux-bridge-test-'))
  const root = path.join(tempRoot, 'root')
  const sibling = path.join(tempRoot, 'root-evil')

  beforeAll(async () => {
    await mkdir(path.join(root, 'nested'), { recursive: true })
    await mkdir(sibling, { recursive: true })
    await writeFile(path.join(root, 'index.html'), '<html></html>', 'utf8')
    await writeFile(path.join(root, 'nested', 'worker.js'), 'export {}', 'utf8')
    await writeFile(path.join(sibling, 'worker.js'), 'export {}', 'utf8')
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  test('accepts an existing file inside the canonical root', () => {
    const resolved = resolveContainedPath(root, '/nested/worker.js')
    expect(resolved).toBe(path.resolve(root, 'nested', 'worker.js'))
  })

  test.each([
    '/../nested/worker.js',
    '/..%2fworker.js',
    '/%2e%2e/worker.js',
    '/%252e%252e%252fworker.js',
    '/..\\worker.js',
    '/%5c%5cserver%5cshare%5cfile.js',
    '/C:/Windows/System32/drivers/etc/hosts',
    '/%00evil.js',
    '/missing.js'
  ])('rejects unsafe path %s', input => {
    expect(resolveContainedPath(root, input)).toBeNull()
  })

  test('rejects sibling-prefix attacks', () => {
    expect(resolveContainedPath(root, '/../root-evil/worker.js')).toBeNull()
  })

  test('accepts a normal streamed result upload without treating request close as a failure', async () => {
    const sourcePath = path.join(root, 'nested', 'worker.js')
    const outputPath = path.join(tempRoot, 'output', 'result.bin')
    const bridge = await startLocalConversionBridge({
      rootDirectory: root,
      sourceFilePath: sourcePath,
      resultFilePath: outputPath,
      resultMimeType: 'application/octet-stream'
    })

    try {
      const uploadResponse = await fetch(bridge.resultUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: Buffer.from('bridge-result')
      })

      expect(uploadResponse.status).toBe(201)
      await bridge.waitForResult()
      await expect(readFile(outputPath, 'utf8')).resolves.toBe('bridge-result')
    } finally {
      await bridge.close()
    }
  })
})
