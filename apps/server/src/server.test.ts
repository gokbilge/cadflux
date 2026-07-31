// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { openAsBlob } from 'node:fs'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { hashPassword } from '@cadflux/auth'
import { openCadFluxDatabase } from '@cadflux/database'
import type { CadFluxDatabase } from '@cadflux/database'
import type { FastifyInstance } from 'fastify'

import { loadServerConfig } from './config'
import { createJobEventBus } from './events'
import { buildServer } from './server'

describe('CadFlux server routes', () => {
  let tempRoot: string
  let app: FastifyInstance | undefined
  let database: CadFluxDatabase | undefined

  async function loginAsAdmin() {
    const login = await app!.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'ChangeThisPassword123!'
      }
    })
    expect(login.statusCode).toBe(200)
    return {
      csrfToken: (login.json() as { csrfToken: string }).csrfToken,
      cookie: login.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
    }
  }

  async function createAdminFixture(configOverrides?: Record<string, string>) {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'cadflux-server-test-'))
    const config = loadServerConfig({
      CADFLUX_DATA_DIR: path.join(tempRoot, 'data'),
      CADFLUX_DATABASE_PATH: path.join(tempRoot, 'data', 'database', 'cadflux.sqlite'),
      CADFLUX_SESSION_SECRET: 'server-test-session-secret-1234567890',
      ...configOverrides
    })
    database = openCadFluxDatabase({ databasePath: config.databasePath })
    database.runMigrations()
    const passwordHash = await hashPassword('ChangeThisPassword123!')
    database.createUser({
      id: 'user-1',
      username: 'admin',
      normalizedUsername: 'admin',
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })
    return config
  }

  afterEach(async () => {
    if (app) {
      await app.close()
      app = undefined
    }
    if (database) {
      database.close()
      database = undefined
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  test('job control routes delegate to worker controller', async () => {
    const config = await createAdminFixture()
    const worker = {
      close: jest.fn(async () => undefined),
      pauseJob: jest.fn(),
      resumeJob: jest.fn(),
      cancelJob: jest.fn(),
      retryJob: jest.fn()
    }
    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker
    })

    const auth = await loginAsAdmin()

    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'draft',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 1,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })
    database!.createJobFile({
      id: 'file-1',
      jobId: 'job-1',
      originalName: 'fixture.dxf',
      relativePath: 'fixture.dxf',
      storedPath: path.join(tempRoot, 'fixture.dxf'),
      sizeBytes: 12,
      checksum: 'abc',
      format: 'dxf',
      status: 'ready',
      progressPercent: 0,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })

    const headers = {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrfToken
    }

    expect((await app.inject({ method: 'POST', url: '/api/v1/jobs/job-1/pause', headers })).statusCode).toBe(200)
    expect(worker.pauseJob).toHaveBeenCalledWith('job-1')

    expect((await app.inject({ method: 'POST', url: '/api/v1/jobs/job-1/resume', headers })).statusCode).toBe(200)
    expect(worker.resumeJob).toHaveBeenCalledWith('job-1')

    expect((await app.inject({ method: 'POST', url: '/api/v1/jobs/job-1/cancel', headers })).statusCode).toBe(200)
    expect(worker.cancelJob).toHaveBeenCalledWith('job-1')

    expect((await app.inject({ method: 'POST', url: '/api/v1/jobs/job-1/retry', headers })).statusCode).toBe(200)
    expect(worker.retryJob).toHaveBeenCalledWith('job-1')

    expect((await app.inject({ method: 'POST', url: '/api/v1/jobs/job-1/start', headers })).statusCode).toBe(200)

  })

  test('report endpoint generates persisted report artifacts', async () => {
    const config = await createAdminFixture()
    const dataDir = path.join(tempRoot, 'data')
    const outputDir = path.join(dataDir, 'jobs', 'job-1', 'output')
    await mkdir(outputDir, { recursive: true })
    await writeFile(path.join(outputDir, 'fixture.pdf'), '%PDF-1.4\n', 'utf8')
    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'completed',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 1,
      completedFiles: 1,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 100,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })
    database!.createJobFile({
      id: 'file-1',
      jobId: 'job-1',
      originalName: 'fixture.dxf',
      relativePath: 'fixture.dxf',
      storedPath: path.join(tempRoot, 'fixture.dxf'),
      sizeBytes: 12,
      checksum: 'abc',
      format: 'dxf',
      status: 'completed',
      progressPercent: 100,
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })
    database!.createArtifact({
      id: 'artifact-1',
      jobId: 'job-1',
      jobFileId: 'file-1',
      type: 'pdf',
      format: 'pdf',
      relativePath: 'fixture.pdf',
      storedPath: path.join(outputDir, 'fixture.pdf'),
      sizeBytes: 9,
      checksum: 'pdfsum',
      mimeType: 'application/pdf',
      fidelity: 'unknown',
      createdAt: '2026-07-31T00:00:00.000Z'
    })

    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })

    const auth = await loginAsAdmin()
    const headers = {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrfToken
    }

    const createReports = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs/job-1/reports',
      headers
    })
    expect(createReports.statusCode).toBe(200)
    const body = createReports.json() as { artifacts: Array<{ type: string }> }
    expect(body.artifacts.some(artifact => artifact.type === 'zip')).toBe(true)
    expect(body.artifacts.some(artifact => artifact.type === 'json_report')).toBe(true)
  })

  test('report endpoint replaces prior generated report artifacts', async () => {
    const config = await createAdminFixture()
    const dataDir = path.join(tempRoot, 'data')
    const outputDir = path.join(dataDir, 'jobs', 'job-1', 'output')
    await mkdir(outputDir, { recursive: true })
    await writeFile(path.join(outputDir, 'fixture.pdf'), '%PDF-1.4\n', 'utf8')

    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'completed',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 1,
      completedFiles: 1,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 100,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })
    database!.createJobFile({
      id: 'file-1',
      jobId: 'job-1',
      originalName: 'fixture.dxf',
      relativePath: 'fixture.dxf',
      storedPath: path.join(tempRoot, 'fixture.dxf'),
      sizeBytes: 12,
      checksum: 'abc',
      format: 'dxf',
      status: 'completed',
      progressPercent: 100,
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })
    database!.createArtifact({
      id: 'artifact-1',
      jobId: 'job-1',
      jobFileId: 'file-1',
      type: 'pdf',
      format: 'pdf',
      relativePath: 'fixture.pdf',
      storedPath: path.join(outputDir, 'fixture.pdf'),
      sizeBytes: 9,
      checksum: 'pdfsum',
      mimeType: 'application/pdf',
      fidelity: 'unknown',
      createdAt: '2026-07-31T00:00:00.000Z'
    })

    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })

    const auth = await loginAsAdmin()
    const headers = {
      cookie: auth.cookie,
      'x-csrf-token': auth.csrfToken
    }

    expect((await app.inject({
      method: 'POST',
      url: '/api/v1/jobs/job-1/reports',
      headers
    })).statusCode).toBe(200)
    expect((await app.inject({
      method: 'POST',
      url: '/api/v1/jobs/job-1/reports',
      headers
    })).statusCode).toBe(200)

    const reports = await app.inject({
      method: 'GET',
      url: '/api/v1/jobs/job-1/reports',
      headers: {
        cookie: auth.cookie
      }
    })
    expect(reports.statusCode).toBe(200)
    const reportBody = reports.json() as { artifacts: Array<{ type: string }> }
    expect(reportBody.artifacts).toHaveLength(5)
    expect(reportBody.artifacts.filter(artifact => artifact.type === 'zip')).toHaveLength(1)
  })

  test('job event stream replays history and delivers live events', async () => {
    const config = await createAdminFixture()
    const events = createJobEventBus()
    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'queued',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 1,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })

    const first = events.publish('job-1', 'job.created', { jobId: 'job-1' })
    events.publish('job-1', 'job.queued', { jobId: 'job-1' })

    app = await buildServer({
      config,
      database: database!,
      events,
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })

    const auth = await loginAsAdmin()
    await app.listen({ host: '127.0.0.1', port: 0 })
    const port = Number((app.server.address() as { port: number }).port)
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/jobs/job-1/events`, {
      headers: {
        Cookie: auth.cookie,
        'Last-Event-ID': first.id
      },
      signal: AbortSignal.timeout(5000)
    })

    expect(response.ok).toBe(true)
    const reader = response.body!.getReader()
    events.publish('job-1', 'file.completed', { jobFileId: 'file-1' })

    let content = ''
    while (!content.includes('event: file.completed')) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      content += new TextDecoder().decode(chunk.value)
      if (content.length > 4096) {
        break
      }
    }

    expect(content).toContain('event: job.queued')
    expect(content).not.toContain('event: job.created')
    expect(content).toContain('event: file.completed')
    await reader.cancel()

  })

  test('upload route rejects uploads after the job has started', async () => {
    const config = await createAdminFixture()
    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'queued',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 0,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })

    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })

    const auth = await loginAsAdmin()
    await app.listen({ host: '127.0.0.1', port: 0 })
    const port = Number((app.server.address() as { port: number }).port)
    const fixturePath = path.join(tempRoot, 'fixture.dxf')
    await writeFile(fixturePath, '0\nEOF\n', 'utf8')

    const form = new FormData()
    form.append('relativePath', 'fixture.dxf')
    form.append(
      'file',
      await openAsBlob(fixturePath, { type: 'application/octet-stream' }),
      'fixture.dxf'
    )

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/jobs/job-1/files`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken
      },
      body: form
    })

    expect(response.status).toBe(409)
    expect(await response.text()).toContain('job_upload_closed')
  })

  test('upload route rejects duplicate relative paths', async () => {
    const config = await createAdminFixture()
    database!.createJob({
      id: 'job-1',
      userId: 'user-1',
      status: 'draft',
      name: 'job',
      profileJson: JSON.stringify({
        id: 'test',
        label: 'Test',
        paper: 'A4',
        orientation: 'auto',
        scale: 'fit',
        color: 'color',
        formats: ['pdf']
      }),
      totalFiles: 1,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: '2026-07-31T00:00:00.000Z',
      version: '0.1.0'
    })
    database!.createJobFile({
      id: 'file-1',
      jobId: 'job-1',
      originalName: 'fixture.dxf',
      relativePath: 'fixture.dxf',
      storedPath: path.join(tempRoot, 'fixture-existing.dxf'),
      sizeBytes: 12,
      checksum: 'abc',
      format: 'dxf',
      status: 'ready',
      progressPercent: 0,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z'
    })

    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })

    const auth = await loginAsAdmin()
    await app.listen({ host: '127.0.0.1', port: 0 })
    const port = Number((app.server.address() as { port: number }).port)
    const fixturePath = path.join(tempRoot, 'fixture-upload.dxf')
    await writeFile(fixturePath, '0\nEOF\n', 'utf8')

    const form = new FormData()
    form.append('relativePath', 'fixture.dxf')
    form.append(
      'file',
      await openAsBlob(fixturePath, { type: 'application/octet-stream' }),
      'fixture.dxf'
    )

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/jobs/job-1/files`, {
      method: 'POST',
      headers: {
        Cookie: auth.cookie,
        'X-CSRF-Token': auth.csrfToken
      },
      body: form
    })

    expect(response.status).toBe(409)
    expect(await response.text()).toContain('duplicate_relative_path')
  })

  test('generic error handler redacts internal details', async () => {
    const config = await createAdminFixture()
    app = await buildServer({
      config,
      database: database!,
      events: createJobEventBus(),
      worker: {
        close: async () => undefined,
        pauseJob: () => undefined,
        resumeJob: () => undefined,
        cancelJob: () => undefined,
        retryJob: () => undefined
      }
    })
    app.get('/boom', async () => {
      throw new Error(`boom ${path.join(tempRoot, 'secret-path.txt')}`)
    })

    const response = await app.inject({
      method: 'GET',
      url: '/boom'
    })

    expect(response.statusCode).toBe(500)
    const body = response.json() as {
      error: {
        code: string
        message: string
        requestId: string
      }
    }
    expect(body.error.code).toBe('internal_error')
    expect(body.error.requestId).toBeTruthy()
    expect(body.error.message).not.toContain('secret-path.txt')
    expect(body.error.message).not.toContain(tempRoot)
  })
})
