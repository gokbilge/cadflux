#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  access,
  mkdir,
  readFile,
  rename,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'

import { CadFluxBatchEngine } from '@cadflux/batch-engine'
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
import { resultsToCsv, resultsToHtml, resultsToJson } from '@cadflux/diagnostics'
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
  error?: string
}

interface WatchPendingEntry {
  stamp: string
  stableSinceMs: number
  attempts: number
  nextEligibleAtMs: number
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
  .action(async (inputs: string[], options: ConvertCommandOptions) => {
    const logger = createLogger(options.logFormat)
    const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
    const sources = await collectCliSources(inputs, options)
    const profile = buildProfile(options)
    const outputDirectory = path.resolve(options.output)
    await mkdir(outputDirectory, { recursive: true })

    const engine = new CadFluxBatchEngine<CadFluxConversionResult>(options.workers)
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
          total: progress.total
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
      await writeReport(path.resolve(options.report), results)
    }

    const failures = results.filter(result => result.status !== 'completed')
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
    const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
    const profile = buildProfile({ preset: options.preset })
    const absoluteInput = path.resolve(inputDirectory)
    const absoluteOutput = path.resolve(options.output)
    const stateDirectory = path.join(absoluteOutput, '.cadflux')
    const ledgerPath = path.join(stateDirectory, 'watch-ledger.json')
    const ledger = await readWatchLedger(ledgerPath)
    const pending = new Map<string, WatchPendingEntry>()
    const sessionResults: CadFluxConversionResult[] = []
    let cancelled = false

    await mkdir(absoluteOutput, { recursive: true })
    await mkdir(stateDirectory, { recursive: true })

    const removeSignalHandlers = installCancellationHandlers(() => {
      cancelled = true
      logger.info('watch.cancelled', { reason: 'signal' })
    })

    logger.info('watch.started', {
      inputDirectory: absoluteInput,
      outputDirectory: absoluteOutput
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
        if (!absolutePath || isNestedPath(absolutePath, absoluteOutput)) {
          continue
        }
        livePaths.add(absolutePath)
        const stamp = createInputStamp(input)
        const current = pending.get(absolutePath)

        if (!current || current.stamp !== stamp) {
          pending.set(absolutePath, {
            stamp,
            stableSinceMs: now,
            attempts: 0,
            nextEligibleAtMs: now + options.debounceMs
          })
          continue
        }

        const ledgerEntry = ledger[absolutePath]
        if (
          ledgerEntry?.stamp === stamp &&
          ledgerEntry.status === 'completed'
        ) {
          continue
        }
        if (current.nextEligibleAtMs > now) {
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
          await writeReport(path.resolve(options.report), sessionResults)
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
          if (options.archiveSuccess) {
            await moveProcessedFile(
              absolutePath,
              absoluteInput,
              path.resolve(options.archiveSuccess)
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
            error: result.error
          }
          logger.error('watch.failed', {
            input: absolutePath,
            attempt: current.attempts,
            error: result.error
          })
          if (
            options.quarantineFailures &&
            current.attempts >= options.maxRetries
          ) {
            await moveProcessedFile(
              absolutePath,
              absoluteInput,
              path.resolve(options.quarantineFailures)
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
  results: CadFluxConversionResult[]
): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true })
  const ext = path.extname(reportPath).toLowerCase()
  const content =
    ext === '.csv'
      ? resultsToCsv(results)
      : ext === '.html'
        ? resultsToHtml(results)
        : resultsToJson(results)
  await writeFile(reportPath, content, 'utf8')
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
  return [input.sizeBytes ?? 0, input.lastModifiedMs ?? 0].join(':')
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

async function moveProcessedFile(
  sourcePath: string,
  inputRoot: string,
  destinationRoot: string
): Promise<void> {
  const relativePath = path.relative(inputRoot, sourcePath)
  const targetPath = path.join(destinationRoot, relativePath)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await rename(sourcePath, targetPath)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
