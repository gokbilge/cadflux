// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  startLocalConversionBridge,
  type LocalConversionBridge
} from '@cadflux/core/browserBridge'
import { chromium } from 'playwright'

export interface PdfRenderRequest {
  inputPath: string
  outputPath: string
}

export interface PdfRenderResult {
  outputPath: string
  rendererBackend: 'playwright-browser-bridge'
}

export interface PdfRendererBackend {
  readonly id: string
  readonly requiresBrowser: boolean

  render(
    request: PdfRenderRequest,
    signal?: AbortSignal
  ): Promise<PdfRenderResult>
}

function runnerDistDir(): string {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..'
  )
  return path.join(packageRoot, 'dist-runner')
}

class PlaywrightBrowserBridgePdfRendererBackend
  implements PdfRendererBackend
{
  readonly id = 'playwright-browser-bridge' as const
  readonly requiresBrowser = true

  async render(
    request: PdfRenderRequest,
    signal?: AbortSignal
  ): Promise<PdfRenderResult> {
    const absoluteInput = path.resolve(request.inputPath)
    const absoluteOutput = path.resolve(request.outputPath)
    const runnerDir = runnerDistDir()

    if (!existsSync(path.join(runnerDir, 'index.html'))) {
      throw new Error(
        'PDF runner is not built. Run "pnpm --filter @cadflux/renderer-pdf build:runner" or "pnpm build:conversion-runners".'
      )
    }

    const bridge = await startLocalConversionBridge({
      rootDirectory: runnerDir,
      sourceFilePath: absoluteInput,
      resultFilePath: absoluteOutput,
      resultMimeType: 'application/pdf'
    })

    return withPlaywrightBridge(
      bridge,
      signal,
      async browser => {
        const page = await browser.newPage()
        await page.goto(bridge.runnerUrl, { waitUntil: 'networkidle' })
        await page.evaluate(
          async ({ fileName, resultUrl, sourceUrl }) => {
            await (
              globalThis as unknown as {
                exportCadToPdf: (request: {
                  fileName: string
                  resultUrl: string
                  sourceUrl: string
                }) => Promise<unknown>
              }
            ).exportCadToPdf({
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

        return {
          outputPath: absoluteOutput,
          rendererBackend: this.id
        }
      }
    )
  }
}

const defaultPdfRendererBackend = new PlaywrightBrowserBridgePdfRendererBackend()

export async function exportPdfFile(
  inputPath: string,
  outputPath: string,
  signal?: AbortSignal
): Promise<string> {
  const result = await defaultPdfRendererBackend.render(
    {
      inputPath,
      outputPath
    },
    signal
  )
  return result.outputPath
}

async function withPlaywrightBridge<T>(
  bridge: LocalConversionBridge,
  signal: AbortSignal | undefined,
  run: (browser: Awaited<ReturnType<typeof chromium.launch>>) => Promise<T>
): Promise<T> {
  const browser = await chromium.launch({ headless: true })
  const abortHandler = () => {
    void browser.close().catch(() => undefined)
  }

  if (signal) {
    if (signal.aborted) {
      abortHandler()
      throw new Error('PDF rendering aborted.')
    }
    signal.addEventListener('abort', abortHandler, { once: true })
  }

  try {
    return await run(browser)
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abortHandler)
    }
    await browser.close().catch(() => undefined)
    await bridge.close()
  }
}
