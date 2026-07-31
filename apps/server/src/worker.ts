// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { fork, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CadFluxProfile } from '@cadflux/core'
import type { CadFluxDatabase, StoredJobFile } from '@cadflux/database'

import type { CadFluxServerConfig } from './config.js'
import type { JobEventBus } from './events.js'

export interface ServerWorkerController {
  close(): Promise<void>
  pauseJob(jobId: string): void
  resumeJob(jobId: string): void
  cancelJob(jobId: string): void
  retryJob(jobId: string): void
}

interface ActiveTask {
  workerId: string
  child: ChildProcess
  fileId: string
  jobId: string
  timer: NodeJS.Timeout
  cancelled: boolean
}

type WorkerMessage =
  | { type: 'stage'; stage: 'parsing' | 'rendering' | 'exporting'; progressPercent: number }
  | {
      type: 'completed'
      warnings: string[]
      artifacts: Array<{
        format: 'pdf' | 'svg'
        relativePath: string
        storedPath: string
        sizeBytes: number
        checksum: string
        mimeType: string
        fidelity: string
      }>
    }
  | { type: 'failed'; error: string }

export function startServerWorker(options: {
  config: CadFluxServerConfig
  database: CadFluxDatabase
  events: JobEventBus
  logger: {
    info(payload: Record<string, unknown>, message?: string): void
    error(payload: Record<string, unknown>, message?: string): void
  }
}): ServerWorkerController {
  const activeTasks = new Map<string, ActiveTask>()
  let closed = false

  const tick = async () => {
    if (closed) {
      return
    }

    recoverStaleClaims(options)
    settlePausingJobs(options, activeTasks)
    settleCancellingJobs(options, activeTasks)

    while (activeTasks.size < options.config.workerConcurrency) {
      const workerId = `worker-${randomUUID()}`
      const nowIso = new Date().toISOString()
      const claimed = options.database.claimNextJobFile(workerId, nowIso)
      if (!claimed) {
        break
      }
      const job = options.database.getJobById(claimed.jobId)
      if (!job) {
        continue
      }
      startChildForFile(options, activeTasks, claimed, workerId)
    }
  }

  const interval = setInterval(() => {
    void tick()
  }, 1000)
  void tick()

  return {
    async close() {
      closed = true
      clearInterval(interval)
      for (const active of activeTasks.values()) {
        active.cancelled = true
        clearTimeout(active.timer)
        active.child.kill()
      }
    },
    pauseJob(jobId) {
      const job = options.database.getJobById(jobId)
      if (!job) {
        return
      }
      options.database.updateJob(job.id, {
        status: 'pausing'
      })
      options.events.publish(job.id, 'job.pause.requested', { jobId: job.id })
      settlePausingJobs(options, activeTasks)
    },
    resumeJob(jobId) {
      const job = options.database.getJobById(jobId)
      if (!job) {
        return
      }
      options.database.updateJob(job.id, {
        status: 'queued',
        cancelRequestedAt: undefined
      })
      options.events.publish(job.id, 'job.resumed', { jobId: job.id })
    },
    cancelJob(jobId) {
      const nowIso = new Date().toISOString()
      options.database.updateJob(jobId, {
        status: 'cancelling',
        cancelRequestedAt: nowIso
      })
      options.database.cancelPendingJobFiles(jobId, nowIso)
      options.events.publish(jobId, 'job.cancel.requested', { jobId })
      for (const active of activeTasks.values()) {
        if (active.jobId !== jobId) {
          continue
        }
        active.cancelled = true
        clearTimeout(active.timer)
        active.child.kill()
      }
      settleCancellingJobs(options, activeTasks)
    },
    retryJob(jobId) {
      const nowIso = new Date().toISOString()
      options.database.resetFailedJobFiles(jobId, nowIso)
      options.database.updateJob(jobId, {
        status: 'queued',
        errorSummary: undefined,
        completedAt: undefined,
        cancelRequestedAt: undefined,
        progressPercent: 0
      })
      recomputeJobState(options.database, jobId)
      options.events.publish(jobId, 'job.retry.requested', { jobId })
    }
  }
}

function startChildForFile(
  options: {
    config: CadFluxServerConfig
    database: CadFluxDatabase
    events: JobEventBus
    logger: {
      info(payload: Record<string, unknown>, message?: string): void
      error(payload: Record<string, unknown>, message?: string): void
    }
  },
  activeTasks: Map<string, ActiveTask>,
  file: StoredJobFile,
  workerId: string
): void {
  const database = options.database
  const job = database.getJobById(file.jobId)
  if (!job) {
    return
  }
  const startedAt = new Date().toISOString()
  const profile = parseProfile(job.profileJson)
  const outputDirectory = path.join(options.config.dataDir, 'jobs', job.id, 'output')
  database.updateJob(job.id, {
    status: 'running',
    startedAt: job.startedAt ?? startedAt
  })
  database.updateJobFile(file.id, {
    status: 'parsing',
    workerId,
    startedAt,
    attemptCount: file.attemptCount + 1,
    updatedAt: startedAt
  })
  options.events.publish(job.id, 'file.started', {
    jobId: job.id,
    jobFileId: file.id,
    workerId
  })
  options.events.publish(job.id, 'job.started', {
    jobId: job.id
  })

  const childModulePath = fileURLToPath(new URL('./worker-child.js', import.meta.url))
  const child = fork(childModulePath, {
    env: {
      ...process.env,
      CADFLUX_WORKER_TASK: JSON.stringify({
        jobId: job.id,
        jobFileId: file.id,
        originalName: file.originalName,
        storedPath: file.storedPath,
        relativePath: file.relativePath,
        sizeBytes: file.sizeBytes,
        format: file.format,
        profile,
        outputDirectory
      })
    },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  })

  const active: ActiveTask = {
    workerId,
    child,
    fileId: file.id,
    jobId: job.id,
    cancelled: false,
    timer: setTimeout(() => {
      active.cancelled = true
      child.kill()
    }, options.config.conversionTimeoutMs)
  }
  activeTasks.set(file.id, active)

  child.on('message', message => {
    handleChildMessage(options, file.id, workerId, message as WorkerMessage)
  })
  child.on('exit', (code, signal) => {
    clearTimeout(active.timer)
    activeTasks.delete(file.id)
    void finalizeChildExit(options, file.id, workerId, active.cancelled, code, signal)
  })
}

function handleChildMessage(
  options: {
    config: CadFluxServerConfig
    database: CadFluxDatabase
    events: JobEventBus
    logger: {
      info(payload: Record<string, unknown>, message?: string): void
      error(payload: Record<string, unknown>, message?: string): void
    }
  },
  fileId: string,
  workerId: string,
  message: WorkerMessage
): void {
  const file = options.database.getJobFileById(fileId)
  if (!file) {
    return
  }
  if (message.type === 'stage') {
    options.database.updateJobFile(file.id, {
      status: message.stage,
      progressPercent: message.progressPercent,
      updatedAt: new Date().toISOString()
    })
    recomputeJobState(options.database, file.jobId)
    options.events.publish(file.jobId, 'file.progress', {
      jobId: file.jobId,
      jobFileId: file.id,
      workerId,
      stage: message.stage,
      progressPercent: message.progressPercent
    })
    return
  }

  if (message.type === 'completed') {
    for (const artifact of message.artifacts) {
      options.database.createArtifact({
        id: randomUUID(),
        jobId: file.jobId,
        jobFileId: file.id,
        type: artifact.format,
        format: artifact.format,
        relativePath: artifact.relativePath,
        storedPath: artifact.storedPath,
        sizeBytes: artifact.sizeBytes,
        checksum: artifact.checksum,
        mimeType: artifact.mimeType,
        fidelity: artifact.fidelity,
        createdAt: new Date().toISOString()
      })
      options.events.publish(file.jobId, 'artifact.created', {
        jobId: file.jobId,
        jobFileId: file.id,
        format: artifact.format,
        relativePath: artifact.relativePath
      })
    }
    options.database.updateJobFile(file.id, {
      status: message.warnings.length > 0 ? 'completed_with_warnings' : 'completed',
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      diagnosticsJson: message.warnings.length > 0 ? JSON.stringify(message.warnings) : undefined,
      resultSummaryJson: JSON.stringify({
        warnings: message.warnings,
        artifactCount: message.artifacts.length
      }),
      updatedAt: new Date().toISOString()
    })
    recomputeJobState(options.database, file.jobId)
    options.events.publish(file.jobId, 'file.completed', {
      jobId: file.jobId,
      jobFileId: file.id,
      workerId,
      warnings: message.warnings,
      artifactCount: message.artifacts.length
    })
    publishTerminalJobEvent(options, file.jobId)
    return
  }

  if (message.type === 'failed') {
    failOrRetryFile(options, file, workerId, message.error)
  }
}

async function finalizeChildExit(
  options: {
    config: CadFluxServerConfig
    database: CadFluxDatabase
    events: JobEventBus
    logger: {
      info(payload: Record<string, unknown>, message?: string): void
      error(payload: Record<string, unknown>, message?: string): void
    }
  },
  fileId: string,
  workerId: string,
  cancelled: boolean,
  code: number | null,
  signal: NodeJS.Signals | null
): Promise<void> {
  const file = options.database.getJobFileById(fileId)
  if (!file) {
    return
  }
  if (['completed', 'completed_with_warnings', 'failed', 'cancelled', 'ready'].includes(file.status)) {
    settlePausingJobs(options, new Map())
    settleCancellingJobs(options, new Map())
    return
  }
  if (cancelled || signal !== null) {
    const job = options.database.getJobById(file.jobId)
    const nowIso = new Date().toISOString()
    if (job?.status === 'cancelling') {
      options.database.updateJobFile(file.id, {
        status: 'cancelled',
        progressPercent: 100,
        completedAt: nowIso,
        errorCode: 'cancelled',
        errorMessage: 'Conversion cancelled.',
        updatedAt: nowIso
      })
      options.events.publish(file.jobId, 'file.failed', {
        jobId: file.jobId,
        jobFileId: file.id,
        workerId,
        error: 'Conversion cancelled.'
      })
    } else {
      failOrRetryFile(options, file, workerId, 'Worker terminated before completion.')
    }
    recomputeJobState(options.database, file.jobId)
    publishTerminalJobEvent(options, file.jobId)
    return
  }
  if (code && code !== 0) {
    failOrRetryFile(options, file, workerId, `Worker exited with code ${code}.`)
    publishTerminalJobEvent(options, file.jobId)
  }
}

function failOrRetryFile(
  options: {
    config: CadFluxServerConfig
    database: CadFluxDatabase
    events: JobEventBus
    logger: {
      info(payload: Record<string, unknown>, message?: string): void
      error(payload: Record<string, unknown>, message?: string): void
    }
  },
  file: StoredJobFile,
  workerId: string,
  errorMessage: string
): void {
  const updated = options.database.getJobFileById(file.id) ?? file
  const nowIso = new Date().toISOString()
  const retryable = updated.attemptCount < updated.maxAttempts
  if (retryable) {
    const nextAttemptAt = new Date(Date.now() + options.config.retryBackoffMs).toISOString()
    options.database.updateJobFile(file.id, {
      status: 'ready',
      progressPercent: 0,
      workerId: undefined,
      claimedAt: undefined,
      startedAt: undefined,
      nextAttemptAt,
      errorCode: 'retry_scheduled',
      errorMessage,
      updatedAt: nowIso
    })
    options.events.publish(file.jobId, 'file.warning', {
      jobId: file.jobId,
      jobFileId: file.id,
      workerId,
      error: errorMessage,
      retryScheduledAt: nextAttemptAt
    })
  } else {
    options.database.updateJobFile(file.id, {
      status: 'failed',
      progressPercent: 100,
      completedAt: nowIso,
      errorCode: 'conversion_failed',
      errorMessage,
      updatedAt: nowIso
    })
    options.events.publish(file.jobId, 'file.failed', {
      jobId: file.jobId,
      jobFileId: file.id,
      workerId,
      error: errorMessage
    })
  }
  recomputeJobState(options.database, file.jobId)
}

function recoverStaleClaims(
  options: {
    config: CadFluxServerConfig
    database: CadFluxDatabase
    events: JobEventBus
    logger: {
      info(payload: Record<string, unknown>, message?: string): void
      error(payload: Record<string, unknown>, message?: string): void
    }
  }
): void {
  const staleBeforeIso = new Date(Date.now() - options.config.staleClaimMinutes * 60_000).toISOString()
  const recovered = options.database.recoverStaleClaimedJobFiles(
    staleBeforeIso,
    new Date().toISOString()
  )
  for (const fileId of recovered.recoveredFileIds) {
    const file = options.database.getJobFileById(fileId)
    if (!file) {
      continue
    }
    recomputeJobState(options.database, file.jobId)
    options.events.publish(file.jobId, 'file.warning', {
      jobId: file.jobId,
      jobFileId: file.id,
      error: 'Recovered stale claimed file.'
    })
  }
}

function settlePausingJobs(
  options: {
    database: CadFluxDatabase
    events: JobEventBus
  },
  activeTasks: Map<string, ActiveTask>
): void {
  for (const job of options.database.listAllJobs()) {
    if (job.status !== 'pausing') {
      continue
    }
    const hasActive = Array.from(activeTasks.values()).some(task => task.jobId === job.id)
    if (hasActive) {
      continue
    }
    options.database.updateJob(job.id, {
      status: 'paused'
    })
    options.events.publish(job.id, 'job.paused', { jobId: job.id })
  }
}

function settleCancellingJobs(
  options: {
    database: CadFluxDatabase
    events: JobEventBus
  },
  activeTasks: Map<string, ActiveTask>
): void {
  for (const job of options.database.listAllJobs()) {
    if (job.status !== 'cancelling') {
      continue
    }
    const hasActive = Array.from(activeTasks.values()).some(task => task.jobId === job.id)
    if (hasActive) {
      continue
    }
    const nowIso = new Date().toISOString()
    options.database.cancelPendingJobFiles(job.id, nowIso)
    recomputeJobState(options.database, job.id)
    options.database.updateJob(job.id, {
      status: 'cancelled',
      completedAt: nowIso
    })
    options.events.publish(job.id, 'job.cancelled', { jobId: job.id })
  }
}

function publishTerminalJobEvent(
  options: { database: CadFluxDatabase; events: JobEventBus },
  jobId: string
): void {
  const job = options.database.getJobById(jobId)
  if (!job) {
    return
  }
  if (job.status === 'completed' || job.status === 'completed_with_warnings') {
    options.events.publish(job.id, 'job.completed', {
      jobId: job.id,
      status: job.status,
      progressPercent: job.progressPercent
    })
  } else if (job.status === 'failed') {
    options.events.publish(job.id, 'job.failed', {
      jobId: job.id,
      errorSummary: job.errorSummary
    })
  }
}

export function recomputeJobState(database: CadFluxDatabase, jobId: string): void {
  const job = database.getJobById(jobId)
  if (!job) {
    return
  }
  const files = database.listJobFiles(jobId)
  const total = files.length
  const completed = files.filter(file => file.status === 'completed').length
  const warningFiles = files.filter(file => file.status === 'completed_with_warnings').length
  const failed = files.filter(file => file.status === 'failed').length
  const cancelled = files.filter(file => file.status === 'cancelled').length
  const finished = completed + warningFiles + failed + cancelled
  const running = files.some(file =>
    ['claimed', 'parsing', 'rendering', 'exporting'].includes(file.status)
  )
  const progressPercent = total === 0 ? 0 : Math.round((finished / total) * 100)

  let status = job.status
  let completedAt = job.completedAt
  let errorSummary = job.errorSummary
  if (total > 0 && finished === total && !running) {
    completedAt = new Date().toISOString()
    if (cancelled === total) {
      status = 'cancelled'
      errorSummary = 'Job cancelled.'
    } else if (failed > 0) {
      status = warningFiles > 0 || completed > 0 ? 'completed_with_warnings' : 'failed'
      errorSummary = `${failed} file(s) failed`
    } else if (warningFiles > 0) {
      status = 'completed_with_warnings'
      errorSummary = `${warningFiles} file(s) completed with warnings`
    } else {
      status = 'completed'
      errorSummary = undefined
    }
  } else if (running || finished < total) {
    if (!['paused', 'pausing', 'cancelling'].includes(job.status)) {
      status = 'running'
    }
    completedAt = undefined
  }

  database.updateJob(jobId, {
    status,
    totalFiles: total,
    completedFiles: completed + warningFiles,
    warningFiles,
    failedFiles: failed,
    cancelledFiles: cancelled,
    progressPercent,
    completedAt,
    errorSummary
  })
}

function parseProfile(profileJson: string): CadFluxProfile {
  const parsed = JSON.parse(profileJson) as CadFluxProfile
  return {
    ...parsed,
    formats: Array.isArray(parsed.formats) && parsed.formats.length > 0 ? parsed.formats : ['pdf']
  }
}
