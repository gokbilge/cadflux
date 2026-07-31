// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { openCadFluxDatabase, type CadFluxDatabase } from './index'

describe('CadFlux database queue behavior', () => {
  let tempRoot = ''
  let database: CadFluxDatabase | undefined

  afterEach(async () => {
    if (database) {
      database.close()
      database = undefined
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  async function createDatabase() {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'cadflux-database-test-'))
    database = openCadFluxDatabase({
      databasePath: path.join(tempRoot, 'cadflux.sqlite')
    })
    database.runMigrations()
    database.createUser({
      id: 'user-1',
      username: 'user',
      normalizedUsername: 'user',
      passwordHash: 'hash',
      role: 'user',
      isActive: true,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })
    return database
  }

  function createJob(id: string, queuedAt: string) {
    database!.createJob({
      id,
      userId: 'user-1',
      status: 'queued',
      name: id,
      profileJson: '{"id":"test","formats":["pdf"]}',
      totalFiles: 0,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: queuedAt,
      version: '0.1.0'
    })
    database!.updateJob(id, {
      queuedAt
    })
  }

  function createJobFile(id: string, jobId: string, createdAt: string, status = 'ready') {
    database!.createJobFile({
      id,
      jobId,
      originalName: `${id}.dxf`,
      relativePath: `${id}.dxf`,
      storedPath: path.join(tempRoot, `${id}.dxf`),
      sizeBytes: 10,
      checksum: id,
      format: 'dxf',
      status,
      progressPercent: 0,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt,
      updatedAt: createdAt
    })
  }

  test('claimNextJobFile uses FIFO job and file ordering', async () => {
    await createDatabase()
    createJob('job-1', '2026-07-31T00:00:00.000Z')
    createJob('job-2', '2026-07-31T01:00:00.000Z')
    createJobFile('file-1b', 'job-1', '2026-07-31T00:10:00.000Z')
    createJobFile('file-1a', 'job-1', '2026-07-31T00:05:00.000Z')
    createJobFile('file-2a', 'job-2', '2026-07-31T01:05:00.000Z')

    const first = database!.claimNextJobFile('worker-1', '2026-07-31T02:00:00.000Z')
    const second = database!.claimNextJobFile('worker-2', '2026-07-31T02:00:01.000Z')
    const third = database!.claimNextJobFile('worker-3', '2026-07-31T02:00:02.000Z')

    expect(first?.id).toBe('file-1a')
    expect(second?.id).toBe('file-1b')
    expect(third?.id).toBe('file-2a')
  })

  test('recoverStaleClaimedJobFiles resets retryable files and fails exhausted files', async () => {
    await createDatabase()
    createJob('job-1', '2026-07-31T00:00:00.000Z')
    createJobFile('retryable', 'job-1', '2026-07-31T00:05:00.000Z')
    createJobFile('exhausted', 'job-1', '2026-07-31T00:06:00.000Z')

    database!.updateJobFile('retryable', {
      status: 'parsing',
      attemptCount: 1,
      workerId: 'worker-1',
      claimedAt: '2026-07-31T00:10:00.000Z',
      startedAt: '2026-07-31T00:10:00.000Z',
      updatedAt: '2026-07-31T00:10:00.000Z'
    })
    database!.updateJobFile('exhausted', {
      status: 'rendering',
      attemptCount: 3,
      maxAttempts: 3,
      workerId: 'worker-2',
      claimedAt: '2026-07-31T00:11:00.000Z',
      startedAt: '2026-07-31T00:11:00.000Z',
      updatedAt: '2026-07-31T00:11:00.000Z'
    })

    const recovered = database!.recoverStaleClaimedJobFiles(
      '2026-07-31T00:30:00.000Z',
      '2026-07-31T01:00:00.000Z'
    )

    expect(recovered.recoveredFileIds).toEqual(['retryable', 'exhausted'])
    expect(database!.getJobFileById('retryable')).toMatchObject({
      status: 'ready',
      workerId: undefined,
      claimedAt: undefined,
      startedAt: undefined
    })
    expect(database!.getJobFileById('exhausted')).toMatchObject({
      status: 'failed',
      errorCode: 'worker_stale',
      errorMessage: 'Worker process became stale.'
    })
  })
})
