#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
import { collectNodeInputs } from '@cadflux/file-ingest/node'
import { resolveArtifactOutputPath } from '@cadflux/plot-engine'
import { CADFLUX_PRESETS, getCadFluxPreset, validateCadFluxProfile } from '@cadflux/presets'
import { exportPdfFile } from '@cadflux/renderer-pdf'
import { exportSvgFile } from '@cadflux/renderer-svg'
import { Command } from 'commander'
import { chromium } from 'playwright'

const CADFLUX_CLI_VERSION = '0.1.0'

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
      const exampleOutputPath = resolveArtifactOutputPath(request, 'pdf')
      const targetDir = path.dirname(exampleOutputPath)
      await mkdir(targetDir, { recursive: true })
      const inputPath = request.input.absolutePath
      if (!inputPath) {
        throw new Error('CLI conversion requires an absolute input path.')
      }

      for (const format of request.profile.formats) {
        const outputPath = resolveArtifactOutputPath(request, format)
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
  .argument('<inputs...>')
  .option('-r, --recursive', 'Scan directories recursively', false)
  .option('--json', 'Output JSON', false)
  .action(async (inputs: string[], options: { recursive: boolean; json: boolean }) => {
    const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
    const sources: CadFluxInputSource[] = await collectNodeInputs(inputs, {
      recursive: options.recursive
    })
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
  })

program
  .command('convert')
  .argument('<inputs...>')
  .option('-r, --recursive', 'Scan directories recursively', false)
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
  .action(async (inputs: string[], options) => {
    const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
    const sources: CadFluxInputSource[] = await collectNodeInputs(inputs, {
      recursive: options.recursive
    })
    const profile = buildProfile(options)
    const outputDirectory = path.resolve(options.output)
    await mkdir(outputDirectory, { recursive: true })

    const tasks = sources.map((source: CadFluxInputSource) => ({
      id: source.absolutePath ?? source.name,
      run: () =>
        runtime.convert({
          input: source,
          outputDirectory,
          profile,
          preserveTree: options.preserveTree,
          overwrite: 'replace'
        })
    }))

    const engine = new CadFluxBatchEngine<CadFluxConversionResult>(options.workers)
    const results = await engine.run(tasks, progress => {
      const status = progress.result?.status ?? 'completed'
      console.log(
        `[${progress.completed}/${progress.total}] ${progress.taskId} -> ${status}`
      )
    })

    if (options.report) {
      await writeReport(path.resolve(options.report), results)
    }

    const failures = results.filter(result => result.status !== 'completed')
    process.exitCode = failures.length > 0 ? 7 : 0
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
  .action(async (inputDirectory: string, options) => {
    const profile = buildProfile({ preset: options.preset })
    const seen = new Map<string, number>()
    const absoluteInput = path.resolve(inputDirectory)
    const absoluteOutput = path.resolve(options.output)
    console.log(`Watching ${absoluteInput}`)

    while (true) {
      const inputs = await collectNodeInputs([absoluteInput], { recursive: true })
      for (const input of inputs) {
        if (!input.absolutePath || input.absolutePath.startsWith(absoluteOutput)) {
          continue
        }
        const currentStamp = `${input.sizeBytes}:${input.lastModifiedMs}`
        if (seen.get(input.absolutePath) === hashStamp(currentStamp)) {
          continue
        }
        seen.set(input.absolutePath, hashStamp(currentStamp))
        const runtime = createCadFluxRuntime(new NodeCadFluxConverter())
        const result = await runtime.convert({
          input,
          outputDirectory: absoluteOutput,
          profile,
          preserveTree: true,
          overwrite: 'replace'
        })
        console.log(`${input.absolutePath} -> ${result.status}`)
      }
      await delay(options.interval)
    }
  })

program.parseAsync().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

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

function hashStamp(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
