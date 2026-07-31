#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { createHash } from 'node:crypto'
import { existsSync, openAsBlob } from 'node:fs'
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

import {
  CadFluxBatchEngine,
  createBatchReportArtifacts,
  createBatchReportFromResults
} from '@cadflux/batch-engine'
import { CADFLUX_DEFAULT_FLAGS } from '@cadflux/config'
import {
  createCadFluxRuntime,
  type CadFluxConversionRequest,
  type CadFluxConversionResult,
  type CadFluxConverter,
  type CadFluxInspection,
  type CadFluxFormat,
  type CadFluxInputSource,
  type CadFluxProfile
} from '@cadflux/core'
import { inspectDwgInput } from '@cadflux/dwg-adapter'
import { inspectDxfInput } from '@cadflux/dxf-adapter'
import { collectNodeInputs, readInputListFile } from '@cadflux/file-ingest/node'
import { resolveArtifactOutputPath } from '@cadflux/plot-engine'
import { CADFLUX_PRESETS, getCadFluxPreset, validateCadFluxProfile } from '@cadflux/presets'
import { exportPdfFile } from '@cadflux/renderer-pdf'
import { exportSvgFile } from '@cadflux/renderer-svg'
import { Command } from 'commander'
import { chromium } from 'playwright'

const CADFLUX_CLI_VERSION = '0.1.0'
const EXIT_SUCCESS = 0
const EXIT_CANCELLED = 130
const EXIT_FAILURE = 1
const EXIT_PARTIAL_FAILURE = 7
const WATCH_TEST_MODE_ENV = 'CADFLUX_CLI_WATCH_TEST_MODE'
type LogFormat = 'text' | 'json'

interface SharedInputOptions {
  recursive: boolean
  inputList?: string
  include: string[]
  exclude: string[]
}

interface ConvertCommandOptions extends SharedInputOptions {
  output: string
  preserveTree: boolean
  paper: string
  orientation: string
  scale: string
  color: string
  format: string
  workers: number
  preset?: string
  report?: string
  overwrite: 'skip' | 'replace'
  logFormat: LogFormat
  deterministic: boolean
}

interface WatchCommandOptions {
  output: string
  preset: string
  interval: number
  debounceMs: number
  retryDelayMs: number
  maxRetries: number
  report?: string
  logFormat: LogFormat
  include: string[]
  exclude: string[]
  archiveSuccess?: string
  quarantineFailures?: string
}

interface WatchLedgerEntry {
  stamp: string
  status: 'completed' | 'failed'
  attempts: number
  lastProcessedAt: string
  nextEligibleAt?: string
  error?: string
}

interface WatchPendingEntry {
  stamp: string
  stableSinceMs: number
  attempts: number
  nextEligibleAtMs: number
}

interface WatchPaths {
  inputDirectory: string
  outputDirectory: string
  stateDirectory: string
  archiveDirectory?: string
  quarantineDirectory?: string
}

interface CliSessionState {
  serverUrl: string
  csrfToken: string
  cookies: Record<string, string>
  username?: string
}

const program = new Command()

class NodeCadFluxConverter implements CadFluxConverter {
  async inspect(input: CadFluxInputSource): Promise<CadFluxInspection> {
    if (input.extension === '.dwg') {
      return inspectDwgInput(input)
    }
    if (input.extension === '.dxf') {
      return inspectDxfInput(input)
    }
    return {
      input,
      detectedFormat: 'unknown',
      warnings: ['Unsupported extension']
    }
  }

  async convert(
    request: CadFluxConversionRequest
  ): Promise<CadFluxConversionResult> {
    const startedAt = Date.now()
    const warnings: string[] = []
    const artifacts = []
    try {
      const inputPath = request.input.absolutePath
      if (!inputPath) {
        throw new Error('CLI conversion requires an absolute input path.')
      }

      for (const format of request.profile.formats) {
        const outputPath = resolveArtifactOutputPath(request, format)
        const targetDir = path.dirname(outputPath)
        await mkdir(targetDir, { recursive: true })

        if (
          request.overwrite === 'skip' &&
          (await pathExists(outputPath))
        ) {
          warnings.push(`Skipped existing ${format.toUpperCase()} artifact: ${outputPath}`)
          artifacts.push({ format, outputPath })
          continue
        }

        if (format === 'pdf') {
          await exportPdfFile(inputPath, outputPath)
        } else {
          await exportSvgFile(inputPath, outputPath)
        }
        artifacts.push({ format, outputPath })
      }

      return {
        input: request.input,
        status: 'completed',
        artifacts,
        warnings,
        durationMs: Date.now() - startedAt
      }
    } catch (error) {
      return {
        input: request.input,
        status: 'failed',
        artifacts,
        warnings,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

class TestWatchCadFluxConverter implements CadFluxConverter {
  private readonly attempts = new Map<string, number>()

  async inspect(input: CadFluxInputSource): Promise<CadFluxInspection> {
    return {
      input,
      detectedFormat: input.extension === '.dwg' ? 'dwg' : input.extension === '.dxf' ? 'dxf' : 'unknown',
      warnings: ['Test watch runtime']
    }
  }

  async convert(
    request: CadFluxConversionRequest
  ): Promise<CadFluxConversionResult> {
    const startedAt = Date.now()
    const inputPath = request.input.absolutePath
    if (!inputPath) {
      throw new Error('CLI conversion requires an absolute input path.')
    }

    const basename = path.basename(inputPath).toLowerCase()
    const attempt = (this.attempts.get(inputPath) ?? 0) + 1
    this.attempts.set(inputPath, attempt)

    if (basename.includes('fail-always')) {
      return {
        input: request.input,
        status: 'failed',
        artifacts: [],
        warnings: ['Test watch runtime forced permanent failure'],
        durationMs: Date.now() - startedAt,
        error: 'forced permanent failure'
      }
    }

    if (basename.includes('fail-once') && attempt === 1) {
      return {
        input: request.input,
        status: 'failed',
        artifacts: [],
        warnings: ['Test watch runtime forced transient failure'],
        durationMs: Date.now() - startedAt,
        error: 'forced transient failure'
      }
    }

    const artifacts = []
    for (const format of request.profile.formats) {
      const outputPath = resolveArtifactOutputPath(request, format)
      await mkdir(path.dirname(outputPath), { recursive: true })
      await writeFile(
        outputPath,
        `test artifact for ${path.basename(inputPath)} (${format})`,
        'utf8'
      )
      artifacts.push({ format, outputPath })
    }

    return {
      input: request.input,
      status: 'completed',
      artifacts,
      warnings: ['Test watch runtime'],
      durationMs: Date.now() - startedAt
    }
  }
}

function buildProfile(options: {
  preset?: string
  paper?: string
  orientation?: string
  scale?: string
  color?: string
  format?: string
}): CadFluxProfile {
  const preset = options.preset ? getCadFluxPreset(options.preset) : undefined
  if (preset) {
    return preset
  }

  const format: CadFluxFormat[] =
    options.format === 'svg'
      ? ['svg']
      : options.format === 'both'
        ? ['pdf', 'svg']
        : ['pdf']

  return {
    id: 'custom',
    label: 'Custom',
    paper: (options.paper as CadFluxProfile['paper']) ?? 'A4',
    orientation:
      (options.orientation as CadFluxProfile['orientation']) ?? 'auto',
    scale: options.scale ?? 'fit',
    color: (options.color as CadFluxProfile['color']) ?? 'color',
    formats: format
  }
}

program.name('cadflux').description('CadFlux CLI')

program
  .command('inspect')
  .argument('[inputs...]')
  .option('-r, --recursive', 'Scan directories recursively', false)
  .option('--input-list <path>', 'Read newline-delimited inputs from file')
  .option('--include <glob>', 'Include glob pattern', collectPatterns, [])
  .option('--exclude <glob>', 'Exclude glob pattern', collectPatterns, [])
  .option('--json', 'Output JSON', false)
  .action(
    async (
      inputs: string[],
      options: SharedInputOptions & { json: boolean }
    ) => {
      const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
      const sources = await collectCliSources(inputs, options)
      const inspections = await Promise.all(
        sources.map(source => runtime.inspect(source))
      )
      if (options.json) {
        console.log(JSON.stringify(inspections, null, 2))
        return
      }
      for (const inspection of inspections) {
        console.log(
          `${inspection.input.absolutePath ?? inspection.input.name}: ${inspection.detectedFormat}`
        )
      }
    }
  )

program
  .command('convert')
  .argument('[inputs...]')
  .option('-r, --recursive', 'Scan directories recursively', false)
  .option('--input-list <path>', 'Read newline-delimited inputs from file')
  .option('--include <glob>', 'Include glob pattern', collectPatterns, [])
  .option('--exclude <glob>', 'Exclude glob pattern', collectPatterns, [])
  .option('-o, --output <directory>', 'Output directory', './cadflux-output')
  .option('--preserve-tree', 'Preserve input directory tree', false)
  .option('--paper <paper>', 'Paper size', 'A4')
  .option('--orientation <mode>', 'portrait|landscape|auto', 'auto')
  .option('--scale <mode>', 'fit or fixed scale expression', 'fit')
  .option('--color <mode>', 'color|monochrome', 'color')
  .option('--format <format>', 'pdf|svg|both', 'pdf')
  .option('--workers <count>', 'Concurrency', value => Number(value), 1)
  .option('--preset <id>', 'Preset id')
  .option('--report <path>', 'Report output path')
  .option('--overwrite <mode>', 'skip|replace', 'replace')
  .option('--log-format <format>', 'text|json', 'text')
  .option('--deterministic', 'Normalize report ordering/timestamps for reproducible report files', false)
  .action(async (inputs: string[], options: ConvertCommandOptions) => {
    const logger = createLogger(options.logFormat)
    const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
    const sources = normalizeDeterministicSources(
      await collectCliSources(inputs, options)
    )
    if (sources.length === 0) {
      throw new Error('No supported DWG or DXF inputs were found.')
    }
    const workerCount = validateWorkerCount(options.workers)
    const profile = buildProfile(options)
    const outputDirectory = path.resolve(options.output)
    await mkdir(outputDirectory, { recursive: true })

    const engine = new CadFluxBatchEngine<CadFluxConversionResult>(workerCount)
    let cancelled = false
    const removeSignalHandlers = installCancellationHandlers(() => {
      cancelled = true
      engine.cancel()
      logger.info('convert.cancelled', { reason: 'signal' })
    })

    const tasks = sources.map((source: CadFluxInputSource) => ({
      id: source.absolutePath ?? source.name,
      run: () =>
        runtime.convert({
          input: source,
          outputDirectory,
          profile,
          preserveTree: options.preserveTree,
          overwrite: options.overwrite
        })
    }))

    const results = await engine.run(tasks, progress => {
      if (progress.status === 'running') {
        logger.info('convert.started', {
          taskId: progress.taskId,
          completed: progress.completed,
          total: progress.total,
          deterministic: options.deterministic
        })
        return
      }
      logger.info('convert.progress', {
        taskId: progress.taskId,
        completed: progress.completed,
        total: progress.total,
        status: progress.result?.status ?? progress.status
      })
    })
    removeSignalHandlers()

    if (options.report) {
      await writeReport(
        path.resolve(options.report),
        profile.id,
        profile.formats,
        results,
        {
          deterministic: options.deterministic
        }
      )
    }

    const failures = results.filter(result => result.status !== 'completed')
    const successfulArtifacts = results.reduce(
      (count, result) => count + result.artifacts.length,
      0
    )
    logger.info('convert.completed', {
      totalInputs: results.length,
      successful: results.length - failures.length,
      failed: failures.length,
      artifacts: successfulArtifacts,
      deterministic: options.deterministic
    })
    if (cancelled) {
      process.exitCode = EXIT_CANCELLED
      return
    }
    process.exitCode = failures.length > 0 ? EXIT_PARTIAL_FAILURE : EXIT_SUCCESS
  })

const presets = program.command('presets').description('Preset utilities')

presets.command('list').action(() => {
  console.log(JSON.stringify(CADFLUX_PRESETS, null, 2))
})

presets
  .command('validate')
  .argument('<file>')
  .action(async (file: string) => {
    const raw = JSON.parse(await readFile(path.resolve(file), 'utf8'))
    if (!validateCadFluxProfile(raw)) {
      throw new Error('Invalid CadFlux profile JSON.')
    }
    console.log('Profile is valid.')
  })

program.command('doctor').action(async () => {
  const info = {
    version: CADFLUX_CLI_VERSION,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    chromiumExecutable: chromium.executablePath(),
    featureFlags: CADFLUX_DEFAULT_FLAGS
  }
  console.log(JSON.stringify(info, null, 2))
})

program.command('version').action(() => {
  console.log(CADFLUX_CLI_VERSION)
})

program
  .command('login')
  .option('--server <url>', 'CadFlux server URL', process.env.CADFLUX_SERVER_URL ?? 'http://localhost:8080')
  .option('--username <username>', 'Username', process.env.CADFLUX_USERNAME)
  .option('--password <password>', 'Password')
  .action(async (options: { server: string; username?: string; password?: string }) => {
    if (!options.username) {
      throw new Error('login requires --username.')
    }
    const password =
      options.password ??
      process.env.CADFLUX_PASSWORD ??
      (await promptForHiddenInput('Password: '))
    if (!password) {
      throw new Error('login requires a password.')
    }
    const response = await fetch(`${normalizeServerUrl(options.server)}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: options.username,
        password
      })
    })
    if (!response.ok) {
      throw new Error(`Login failed with status ${response.status}.`)
    }
    const payload = await response.json() as { csrfToken: string }
    const cookies = cookiesFromResponse(response)
    await writeSessionState({
      serverUrl: normalizeServerUrl(options.server),
      csrfToken: payload.csrfToken,
      cookies,
      username: options.username
    })
    console.log('Logged in.')
  })

program.command('logout').action(async () => {
  const session = await readSessionState()
  if (session) {
    await serverFetch(session, '/api/v1/auth/logout', {
      method: 'POST'
    }).catch(() => undefined)
  }
  await clearSessionState()
  console.log('Logged out.')
})

const jobsCommand = program.command('jobs').description('Server-backed job commands')

jobsCommand.command('list').action(async () => {
  const session = await requireSessionState()
  const payload = await serverFetchJson<{ jobs: Array<Record<string, unknown>> }>(session, '/api/v1/jobs')
  console.log(JSON.stringify(payload.jobs, null, 2))
})

jobsCommand
  .command('create')
  .requiredOption('--name <name>', 'Job name')
  .option('--profile <profileId>', 'Profile id')
  .action(async (options: { name: string; profile?: string }) => {
    const session = await requireSessionState()
    const profilesPayload = await serverFetchJson<{ profiles: Array<{ id: string; profileJson: string }> }>(
      session,
      '/api/v1/profiles'
    )
    const profile =
      profilesPayload.profiles.find(item => item.id === options.profile) ??
      profilesPayload.profiles[0]
    if (!profile) {
      throw new Error('No server profiles available.')
    }
    const payload = await serverFetchJson<{ job: { id: string } }>(session, '/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        profileJson: profile.profileJson
      })
    })
    console.log(payload.job.id)
  })

jobsCommand.command('status').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  const payload = await serverFetchJson<{ job: Record<string, unknown> }>(session, `/api/v1/jobs/${jobId}`)
  console.log(JSON.stringify(payload.job, null, 2))
})

jobsCommand.command('start').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  await serverFetchJson(session, `/api/v1/jobs/${jobId}/start`, { method: 'POST' })
  console.log(`Started ${jobId}.`)
})

jobsCommand.command('pause').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  await serverFetchJson(session, `/api/v1/jobs/${jobId}/pause`, { method: 'POST' })
  console.log(`Paused ${jobId}.`)
})

jobsCommand.command('resume').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  await serverFetchJson(session, `/api/v1/jobs/${jobId}/resume`, { method: 'POST' })
  console.log(`Resumed ${jobId}.`)
})

jobsCommand.command('cancel').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  await serverFetchJson(session, `/api/v1/jobs/${jobId}/cancel`, { method: 'POST' })
  console.log(`Cancelled ${jobId}.`)
})

jobsCommand.command('retry').argument('<jobId>').action(async (jobId: string) => {
  const session = await requireSessionState()
  await serverFetchJson(session, `/api/v1/jobs/${jobId}/retry`, { method: 'POST' })
  console.log(`Retried ${jobId}.`)
})

jobsCommand
  .command('download')
  .argument('<jobId>')
  .option('-o, --output <path>', 'Output ZIP path')
  .action(async (jobId: string, options: { output?: string }) => {
    const session = await requireSessionState()
    await serverFetchJson(session, `/api/v1/jobs/${jobId}/reports`, { method: 'POST' })
    const reports = await serverFetchJson<{ artifacts: Array<{ id: string; type: string; relativePath: string }> }>(
      session,
      `/api/v1/jobs/${jobId}/reports`
    )
    const zipArtifact = reports.artifacts.find(item => item.type === 'zip')
    if (!zipArtifact) {
      throw new Error('ZIP report artifact not found.')
    }
    const response = await serverFetch(session, `/api/v1/artifacts/${zipArtifact.id}/download`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const outputPath = path.resolve(options.output ?? path.basename(zipArtifact.relativePath))
    await writeFile(outputPath, Buffer.from(bytes))
    console.log(outputPath)
  })

program
  .command('upload')
  .argument('<paths...>')
  .requiredOption('--job <jobId>', 'Existing draft or queued job id')
  .option('-r, --recursive', 'Scan directories recursively', false)
  .option('--input-list <path>', 'Read newline-delimited inputs from file')
  .option('--include <glob>', 'Include glob pattern', collectPatterns, [])
  .option('--exclude <glob>', 'Exclude glob pattern', collectPatterns, [])
  .action(async (inputs: string[], options: SharedInputOptions & { job: string }) => {
    const session = await requireSessionState()
    const sources = await collectCliSources(inputs, options)
    for (const source of sources) {
      if (!source.absolutePath) {
        continue
      }
      const relativePath = source.relativePath ?? source.name
      const body = new FormData()
      body.append('relativePath', relativePath)
      body.append(
        'file',
        await openAsBlob(source.absolutePath, {
          type: 'application/octet-stream'
        }),
        source.name
      )
      await serverFetchJson(session, `/api/v1/jobs/${options.job}/files`, {
        method: 'POST',
        body
      })
      console.log(`Uploaded ${relativePath}`)
    }
  })

const profilesCommand = program.command('profiles').description('Server-backed profile commands')
profilesCommand.command('list').action(async () => {
  const session = await requireSessionState()
  const payload = await serverFetchJson<{ profiles: Array<Record<string, unknown>> }>(session, '/api/v1/profiles')
  console.log(JSON.stringify(payload.profiles, null, 2))
})

program
  .command('watch')
  .argument('<inputDirectory>')
  .option('-o, --output <directory>', 'Output directory', './cadflux-output')
  .option('--preset <id>', 'Preset id', 'a4-fit-pdf')
  .option('--interval <ms>', 'Polling interval', value => Number(value), 2000)
  .option('--debounce-ms <ms>', 'Stable-write debounce', value => Number(value), 1500)
  .option('--retry-delay-ms <ms>', 'Retry delay for failed files', value => Number(value), 5000)
  .option('--max-retries <count>', 'Retry count before waiting for file change', value => Number(value), 3)
  .option('--report <path>', 'Report output path')
  .option('--log-format <format>', 'text|json', 'text')
  .option('--include <glob>', 'Include glob pattern', collectPatterns, [])
  .option('--exclude <glob>', 'Exclude glob pattern', collectPatterns, [])
  .option('--archive-success <directory>', 'Move converted source files after success')
  .option('--quarantine-failures <directory>', 'Move permanently failing source files after retries')
  .action(async (inputDirectory: string, options: WatchCommandOptions) => {
    const logger = createLogger(options.logFormat)
    const runtime = createCadFluxRuntime(
      process.env[WATCH_TEST_MODE_ENV] === '1'
        ? new TestWatchCadFluxConverter()
        : new NodeCadFluxConverter()
    )
    const profile = buildProfile({ preset: options.preset })
    const absoluteInput = path.resolve(inputDirectory)
    const absoluteOutput = path.resolve(options.output)
    const stateDirectory = path.join(absoluteOutput, '.cadflux')
    const archiveDirectory = options.archiveSuccess
      ? path.resolve(options.archiveSuccess)
      : undefined
    const quarantineDirectory = options.quarantineFailures
      ? path.resolve(options.quarantineFailures)
      : undefined
    const ledgerPath = path.join(stateDirectory, 'watch-ledger.json')
    const ledger = await readWatchLedger(ledgerPath)
    const pending = new Map<string, WatchPendingEntry>()
    const sessionResults: CadFluxConversionResult[] = []
    let cancelled = false

    const watchPaths = validateWatchPaths({
      inputDirectory: absoluteInput,
      outputDirectory: absoluteOutput,
      stateDirectory,
      archiveDirectory,
      quarantineDirectory
    })

    await mkdir(absoluteOutput, { recursive: true })
    await mkdir(stateDirectory, { recursive: true })
    if (archiveDirectory) {
      await mkdir(archiveDirectory, { recursive: true })
    }
    if (quarantineDirectory) {
      await mkdir(quarantineDirectory, { recursive: true })
    }

    const removeSignalHandlers = installCancellationHandlers(() => {
      cancelled = true
      logger.info('watch.cancelled', { reason: 'signal' })
    })

    logger.info('watch.started', {
      inputDirectory: absoluteInput,
      outputDirectory: absoluteOutput,
      archiveDirectory,
      quarantineDirectory
    })

    while (!cancelled) {
      const now = Date.now()
      const inputs = await collectNodeInputs([absoluteInput], {
        recursive: true,
        include: options.include,
        exclude: options.exclude
      })
      const livePaths = new Set<string>()

      for (const input of inputs) {
        const absolutePath = input.absolutePath
        if (
          !absolutePath ||
          isWatchManagedPath(absolutePath, watchPaths)
        ) {
          continue
        }
        livePaths.add(absolutePath)
        const stamp = createInputStamp(input)
        const current = pending.get(absolutePath)
        const ledgerEntry = ledger[absolutePath]

        if (!current || current.stamp !== stamp) {
          pending.set(absolutePath, {
            stamp,
            stableSinceMs: now,
            attempts:
              ledgerEntry?.stamp === stamp && ledgerEntry.status === 'failed'
                ? ledgerEntry.attempts
                : 0,
            nextEligibleAtMs:
              ledgerEntry?.stamp === stamp && ledgerEntry.nextEligibleAt
                ? Math.max(
                    now + options.debounceMs,
                    new Date(ledgerEntry.nextEligibleAt).getTime()
                  )
                : now + options.debounceMs
          })
          continue
        }

        if (
          ledgerEntry?.stamp === stamp &&
          ledgerEntry.status === 'completed'
        ) {
          continue
        }
        if (ledgerEntry?.stamp !== stamp) {
          delete ledger[absolutePath]
        }
        if (current.stableSinceMs + options.debounceMs > now) {
          continue
        }
        if (current.nextEligibleAtMs > now) {
          continue
        }
        if (!(await isStableOnDisk(absolutePath, stamp))) {
          current.stableSinceMs = now
          current.nextEligibleAtMs = now + options.debounceMs
          continue
        }

        logger.info('watch.processing', { input: absolutePath, attempt: current.attempts + 1 })
        const result = await runtime.convert({
          input,
          outputDirectory: absoluteOutput,
          profile,
          preserveTree: true,
          overwrite: 'replace'
        })
        sessionResults.push(result)

        if (options.report) {
          await writeReport(
            path.resolve(options.report),
            profile.id,
            profile.formats,
            sessionResults
          )
        }

        if (result.status === 'completed') {
          ledger[absolutePath] = {
            stamp,
            status: 'completed',
            attempts: current.attempts + 1,
            lastProcessedAt: new Date().toISOString()
          }
          logger.info('watch.completed', {
            input: absolutePath,
            artifacts: result.artifacts.map(artifact => artifact.outputPath)
          })
          pending.delete(absolutePath)
          if (archiveDirectory) {
            await moveProcessedFile(
              absolutePath,
              absoluteInput,
              archiveDirectory
            )
          }
        } else {
          current.attempts += 1
          current.nextEligibleAtMs = now + options.retryDelayMs
          ledger[absolutePath] = {
            stamp,
            status: 'failed',
            attempts: current.attempts,
            lastProcessedAt: new Date().toISOString(),
            nextEligibleAt: new Date(current.nextEligibleAtMs).toISOString(),
            error: result.error
          }
          logger.error('watch.failed', {
            input: absolutePath,
            attempt: current.attempts,
            error: result.error
          })
          if (
            quarantineDirectory &&
            current.attempts >= options.maxRetries
          ) {
            await moveProcessedFile(
              absolutePath,
              absoluteInput,
              quarantineDirectory
            )
            pending.delete(absolutePath)
          }
        }

        await writeWatchLedger(ledgerPath, ledger)
      }

      for (const pendingPath of pending.keys()) {
        if (!livePaths.has(pendingPath)) {
          pending.delete(pendingPath)
        }
      }

      await delay(options.interval)
    }

    removeSignalHandlers()
    process.exitCode = EXIT_CANCELLED
  })

program.parseAsync().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = EXIT_FAILURE
})

async function collectCliSources(
  cliInputs: string[],
  options: SharedInputOptions
): Promise<CadFluxInputSource[]> {
  const inputs = [...cliInputs]
  if (options.inputList) {
    inputs.push(...(await readInputListFile(options.inputList)))
  }
  if (inputs.length === 0) {
    throw new Error('At least one input path or --input-list is required.')
  }
  return collectNodeInputs(inputs, {
    recursive: options.recursive,
    include: options.include,
    exclude: options.exclude
  })
}

function collectPatterns(value: string, previous: string[]): string[] {
  const patterns = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return [...previous, ...patterns]
}

function createLogger(format: string) {
  const resolvedFormat: LogFormat = format === 'json' ? 'json' : 'text'
  return {
    info(event: string, payload: Record<string, unknown>) {
      writeLog(resolvedFormat, 'info', event, payload)
    },
    error(event: string, payload: Record<string, unknown>) {
      writeLog(resolvedFormat, 'error', event, payload)
    }
  }
}

async function readSessionState(): Promise<CliSessionState | null> {
  const sessionFilePath = getCadFluxSessionFilePath()
  if (!existsSync(sessionFilePath)) {
    return null
  }
  try {
    await tightenSessionFilePermissions(sessionFilePath)
    return JSON.parse(await readFile(sessionFilePath, 'utf8')) as CliSessionState
  } catch {
    return null
  }
}

async function requireSessionState(): Promise<CliSessionState> {
  const session = await readSessionState()
  if (!session) {
    throw new Error('No saved CadFlux session. Run "cadflux login" first.')
  }
  return session
}

async function writeSessionState(session: CliSessionState): Promise<void> {
  const sessionFilePath = getCadFluxSessionFilePath()
  await mkdir(path.dirname(sessionFilePath), { recursive: true })
  await writeFile(sessionFilePath, JSON.stringify(session, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
  await tightenSessionFilePermissions(sessionFilePath)
}

async function clearSessionState(): Promise<void> {
  const sessionFilePath = getCadFluxSessionFilePath()
  if (existsSync(sessionFilePath)) {
    await rm(sessionFilePath, { force: true })
  }
}

function getCadFluxSessionFilePath(): string {
  return process.env.CADFLUX_SESSION_FILE
    ? path.resolve(process.env.CADFLUX_SESSION_FILE)
    : path.join(homedir(), '.cadflux-session.json')
}

async function tightenSessionFilePermissions(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    return
  }
  await chmod(filePath, 0o600)
}

async function promptForHiddenInput(promptText: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Password prompt requires a TTY. Use CADFLUX_PASSWORD for non-interactive login.')
  }

  return await new Promise<string>((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    let value = ''

    const cleanup = () => {
      stdin.removeListener('data', handleData)
      if (stdin.isTTY) {
        stdin.setRawMode(false)
      }
      stdin.pause()
    }

    const handleData = (chunk: Buffer) => {
      const input = chunk.toString('utf8')
      if (input === '\u0003') {
        cleanup()
        stdout.write('\n')
        reject(new Error('Password prompt cancelled.'))
        return
      }
      if (input === '\r' || input === '\n') {
        cleanup()
        stdout.write('\n')
        resolve(value)
        return
      }
      if (input === '\b' || input === '\x7f') {
        value = value.slice(0, -1)
        return
      }
      value += input
    }

    stdout.write(promptText)
    if (stdin.isTTY) {
      stdin.setRawMode(true)
    }
    stdin.resume()
    stdin.on('data', handleData)
  })
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/u, '')
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

function cookiesFromResponse(response: Response): Record<string, string> {
  const setCookies =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : [])
  const cookies: Record<string, string> = {}
  for (const header of setCookies) {
    const [firstPart] = header.split(';')
    const equalsIndex = firstPart.indexOf('=')
    if (equalsIndex <= 0) {
      continue
    }
    const name = firstPart.slice(0, equalsIndex).trim()
    const value = firstPart.slice(equalsIndex + 1).trim()
    cookies[name] = value
  }
  return cookies
}

async function serverFetch(
  session: CliSessionState,
  resourcePath: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  if (session.csrfToken && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', session.csrfToken)
  }
  if (Object.keys(session.cookies).length > 0) {
    headers.set('Cookie', cookieHeader(session.cookies))
  }
  if (
    !headers.has('Content-Type') &&
    init.body &&
    !(init.body instanceof Buffer) &&
    typeof init.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${normalizeServerUrl(session.serverUrl)}${resourcePath}`, {
    ...init,
    headers
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with status ${response.status}.`)
  }
  return response
}

async function serverFetchJson<T = unknown>(
  session: CliSessionState,
  resourcePath: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await serverFetch(session, resourcePath, init)
  const text = await response.text()
  return (text.length > 0 ? JSON.parse(text) : {}) as T
}

function writeLog(
  format: LogFormat,
  level: 'info' | 'error',
  event: string,
  payload: Record<string, unknown>
) {
  if (format === 'json') {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...payload
      })
    )
    return
  }
  const details = Object.entries(payload)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')
  const line = details.length > 0 ? `[${event}] ${details}` : `[${event}]`
  if (level === 'error') {
    console.error(line)
    return
  }
  console.log(line)
}

function installCancellationHandlers(onCancel: () => void) {
  const handleSignal = () => onCancel()
  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
  return () => {
    process.off('SIGINT', handleSignal)
    process.off('SIGTERM', handleSignal)
  }
}

async function writeReport(
  reportPath: string,
  presetId: string,
  formatIds: CadFluxFormat[],
  results: CadFluxConversionResult[],
  options?: {
    deterministic?: boolean
  }
): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true })
  const normalizedResults =
    options?.deterministic
      ? createDeterministicResults(results)
      : results
  const reportId = options?.deterministic
    ? createDeterministicReportId(presetId, formatIds, normalizedResults)
    : undefined
  const createdAt = options?.deterministic
    ? '1970-01-01T00:00:00.000Z'
    : undefined
  const report = createBatchReportFromResults(
    {
      id: reportId,
      createdAt,
      presetId,
      strategy: 'filesystem',
      formatIds
    },
    normalizedResults,
    (_, artifact) => ({
      format: artifact.format,
      outputPath: artifact.outputPath,
      relativeOutputPath: toPortablePath(
        path.relative(
          path.dirname(reportPath),
          artifact.outputPath
        )
      ),
      sizeBytes: undefined
    })
  )
  const reportFiles = createBatchReportArtifacts(report)
  const reportBasePath = stripKnownReportExtension(reportPath)

  await writeFile(`${reportBasePath}.json`, reportFiles.json, 'utf8')
  await writeFile(`${reportBasePath}.csv`, reportFiles.csv, 'utf8')
  await writeFile(`${reportBasePath}.html`, reportFiles.html, 'utf8')
  await writeFile(`${reportBasePath}.manifest.json`, reportFiles.manifest, 'utf8')
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

function createInputStamp(input: CadFluxInputSource): string {
  return createStampFromStats(
    input.sizeBytes ?? 0,
    input.lastModifiedMs ?? 0
  )
}

function isNestedPath(targetPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function readWatchLedger(
  ledgerPath: string
): Promise<Record<string, WatchLedgerEntry>> {
  try {
    return JSON.parse(await readFile(ledgerPath, 'utf8')) as Record<
      string,
      WatchLedgerEntry
    >
  } catch {
    return {}
  }
}

async function writeWatchLedger(
  ledgerPath: string,
  ledger: Record<string, WatchLedgerEntry>
): Promise<void> {
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8')
}

function validateWatchPaths(paths: WatchPaths): WatchPaths {
  if (isNestedPath(paths.outputDirectory, paths.inputDirectory)) {
    throw new Error('Watch output directory cannot be inside the watched input directory.')
  }
  if (paths.archiveDirectory && isNestedPath(paths.archiveDirectory, paths.inputDirectory)) {
    throw new Error('Archive directory cannot be inside the watched input directory.')
  }
  if (
    paths.quarantineDirectory &&
    isNestedPath(paths.quarantineDirectory, paths.inputDirectory)
  ) {
    throw new Error('Quarantine directory cannot be inside the watched input directory.')
  }
  if (
    paths.archiveDirectory &&
    paths.quarantineDirectory &&
    (isNestedPath(paths.archiveDirectory, paths.quarantineDirectory) ||
      isNestedPath(paths.quarantineDirectory, paths.archiveDirectory))
  ) {
    throw new Error('Archive and quarantine directories must not contain each other.')
  }
  return paths
}

function isWatchManagedPath(targetPath: string, watchPaths: WatchPaths): boolean {
  return [
    watchPaths.outputDirectory,
    watchPaths.stateDirectory,
    watchPaths.archiveDirectory,
    watchPaths.quarantineDirectory
  ]
    .filter((value): value is string => Boolean(value))
    .some(candidate => isNestedPath(targetPath, candidate))
}

async function isStableOnDisk(
  absolutePath: string,
  expectedStamp: string
): Promise<boolean> {
  try {
    const details = await stat(absolutePath)
    return createStampFromStats(details.size, details.mtimeMs) === expectedStamp
  } catch {
    return false
  }
}

function createStampFromStats(sizeBytes: number, modifiedMs: number): string {
  return [sizeBytes, Math.trunc(modifiedMs)].join(':')
}

async function moveProcessedFile(
  sourcePath: string,
  inputRoot: string,
  destinationRoot: string
): Promise<void> {
  const relativePath = path.relative(inputRoot, sourcePath)
  const targetPath = path.join(destinationRoot, relativePath)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await rm(targetPath, { force: true })
  try {
    await rename(sourcePath, targetPath)
  } catch {
    await copyFile(sourcePath, targetPath)
    await rm(sourcePath, { force: true })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stripKnownReportExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.json' || ext === '.csv' || ext === '.html') {
    return filePath.slice(0, -ext.length)
  }
  return filePath
}

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function validateWorkerCount(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Worker count must be a positive integer.')
  }
  return value
}

function normalizeDeterministicSources(
  sources: CadFluxInputSource[]
): CadFluxInputSource[] {
  return [...sources].sort((left, right) => {
    const leftKey = left.relativePath ?? left.absolutePath ?? left.name
    const rightKey = right.relativePath ?? right.absolutePath ?? right.name
    return leftKey.localeCompare(rightKey)
  })
}

function createDeterministicResults(
  results: CadFluxConversionResult[]
): CadFluxConversionResult[] {
  return [...results]
    .map(result => ({
      ...result,
      durationMs: 0,
      warnings: [...result.warnings].sort(),
      artifacts: [...result.artifacts].sort((left, right) =>
        left.outputPath.localeCompare(right.outputPath)
      )
    }))
    .sort((left, right) => {
      const leftKey =
        left.input.relativePath ?? left.input.absolutePath ?? left.input.name
      const rightKey =
        right.input.relativePath ?? right.input.absolutePath ?? right.input.name
      return leftKey.localeCompare(rightKey)
    })
}

function createDeterministicReportId(
  presetId: string,
  formatIds: CadFluxFormat[],
  results: CadFluxConversionResult[]
): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        presetId,
        formatIds,
        results: results.map(result => ({
          input:
            result.input.relativePath ??
            result.input.absolutePath ??
            result.input.name,
          status: result.status,
          warnings: result.warnings,
          error: result.error,
          artifacts: result.artifacts.map(artifact => ({
            format: artifact.format,
            outputPath: artifact.outputPath
          }))
        }))
      })
    )
    .digest('hex')
    .slice(0, 16)
  return `cadflux-${digest}`
}
