// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

function runnerDistDir(): string {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  return path.join(packageRoot, 'dist-runner')
}

async function startStaticServer(root: string): Promise<{
  url: string
  close: () => Promise<void>
}> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        const relative =
          urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '')
        const filePath = path.join(root, relative)

        if (!filePath.startsWith(root) || !existsSync(filePath)) {
          res.writeHead(404)
          res.end()
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const contentType: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json',
          '.wasm': 'application/wasm'
        }
        res.setHeader(
          'Content-Type',
          contentType[ext] ?? 'application/octet-stream'
        )
        res.writeHead(200)
        res.end(await readFile(filePath))
      } catch (error) {
        reject(error)
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start PDF export server.'))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close(err => (err ? closeReject(err) : closeResolve()))
          })
      })
    })
  })
}

export async function exportPdfFile(
  inputPath: string,
  outputPath: string
): Promise<string> {
  const absoluteInput = path.resolve(inputPath)
  const absoluteOutput = path.resolve(outputPath)
  const runnerDir = runnerDistDir()

  if (!existsSync(path.join(runnerDir, 'index.html'))) {
    throw new Error(
      'PDF runner is not built. Run "pnpm --filter @cadflux/renderer-pdf build".'
    )
  }

  const fileName = path.basename(absoluteInput)
  const fileBytes = await readFile(absoluteInput)
  const server = await startStaticServer(runnerDir)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    await page.goto(`${server.url}/index.html`, { waitUntil: 'networkidle' })
    const pdfBytes = await page.evaluate(
      async ({ name, data }) => {
        const bytes = new Uint8Array(data)
        return (
          globalThis as unknown as {
            exportCadToPdf: (
              fileName: string,
              bytes: Uint8Array
            ) => Promise<number[]>
          }
        ).exportCadToPdf(name, bytes)
      },
      { name: fileName, data: [...fileBytes] }
    )
    await writeFile(absoluteOutput, Buffer.from(pdfBytes))
    return absoluteOutput
  } finally {
    await browser.close()
    await server.close()
  }
}
