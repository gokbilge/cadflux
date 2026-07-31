// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { startLocalConversionBridge } from '@cadflux/core/browserBridge'
import { chromium } from 'playwright'

function runnerDistDir(): string {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..'
  )
  return path.join(packageRoot, 'dist-runner')
}

export async function exportSvgFile(
  inputPath: string,
  outputPath: string,
  signal?: AbortSignal
): Promise<string> {
  const absoluteInput = path.resolve(inputPath)
  const absoluteOutput = path.resolve(outputPath)
  const runnerDir = runnerDistDir()

  if (!existsSync(path.join(runnerDir, 'index.html'))) {
    throw new Error(
        'SVG runner is not built. Run "pnpm --filter @cadflux/renderer-svg build:runner" or "pnpm build:conversion-runners".'
    )
  }

  const bridge = await startLocalConversionBridge({
    rootDirectory: runnerDir,
    sourceFilePath: absoluteInput,
    resultFilePath: absoluteOutput,
    resultMimeType: 'image/svg+xml'
  })
  const browser = await chromium.launch({ headless: true })
  const abortHandler = () => {
    void browser.close().catch(() => undefined)
  }

  if (signal) {
    if (signal.aborted) {
      abortHandler()
      throw new Error('SVG rendering aborted.')
    }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  try {
    const page = await browser.newPage()
    await page.goto(bridge.runnerUrl, { waitUntil: 'networkidle' })
    await page.evaluate(
      async ({ fileName, resultUrl, sourceUrl }) => {
        return (
          globalThis as unknown as {
            exportCadToSvg: (request: {
              fileName: string
              resultUrl: string
              sourceUrl: string
            }) => Promise<void>
          }
        ).exportCadToSvg({
          fileName,
          resultUrl,
          sourceUrl
        })
      },
      {
        fileName: path.basename(absoluteInput),
        resultUrl: bridge.resultUrl,
        sourceUrl: bridge.sourceUrl
      }
    )
    await bridge.waitForResult()
    return absoluteOutput
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abortHandler)
    }
    await browser.close().catch(() => undefined)
    await bridge.close()
  }
}
