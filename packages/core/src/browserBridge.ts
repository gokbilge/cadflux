// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, realpathSync, statSync } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm'
}

export interface LocalConversionBridge {
  runnerUrl: string
  resultUrl: string
  sourceUrl: string
  close(): Promise<void>
  waitForResult(): Promise<void>
}

export async function startLocalConversionBridge(options: {
  resultFilePath: string
  resultMimeType: string
  rootDirectory: string
  sourceFilePath: string
}): Promise<LocalConversionBridge> {
  const canonicalRoot = realpathSync(options.rootDirectory)
  const canonicalSourceFile = realpathSync(options.sourceFilePath)
  const sourceToken = createOpaqueToken()
  const resultToken = createOpaqueToken()
  const resultFilePath = path.resolve(options.resultFilePath)
  const temporaryResultFilePath = `${resultFilePath}.part`

  let sourceTokenActive = true
  let resultTokenActive = true
  let resolveResult!: () => void
  let rejectResult!: (error: unknown) => void
  const resultPromise = new Promise<void>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  const server = createServer(async (request, response) => {
    try {
      setBridgeHeaders(response)

      const requestMethod = (request.method ?? 'GET').toUpperCase()
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
      const pathname = requestUrl.pathname

      if (pathname === `/__cadflux/source/${sourceToken}`) {
        await handleSourceRequest({
          canonicalSourceFile,
          request,
          requestMethod,
          response,
          tokenActive: sourceTokenActive
        })
        if (requestMethod === 'GET' || requestMethod === 'HEAD') {
          sourceTokenActive = false
        }
        return
      }

      if (pathname === `/__cadflux/result/${resultToken}`) {
        if (!resultTokenActive) {
          response.writeHead(404)
          response.end()
          return
        }
        resultTokenActive = false
        await handleResultRequest({
          request,
          requestMethod,
          response,
          resultFilePath,
          resultMimeType: options.resultMimeType,
          temporaryResultFilePath
        })
        resolveResult()
        return
      }

      if (requestMethod !== 'GET' && requestMethod !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' })
        response.end()
        return
      }

      const containedPath = resolveContainedPath(canonicalRoot, pathname)
      if (!containedPath) {
        response.writeHead(404)
        response.end()
        return
      }

      await sendFileResponse({
        filePath: containedPath,
        method: requestMethod,
        request,
        response
      })
    } catch (error) {
      resultTokenActive = false
      rejectResult(error)
      if (!response.headersSent) {
        response.writeHead(500)
      }
      response.end()
    }
  })

  const address = await new Promise<{ port: number }>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const serverAddress = server.address()
      if (!serverAddress || typeof serverAddress === 'string') {
        reject(new Error('Failed to start local conversion bridge server.'))
        return
      }
      resolve({ port: serverAddress.port })
    })
  })

  const runnerUrl = `http://127.0.0.1:${address.port}/index.html`

  return {
    runnerUrl,
    sourceUrl: `http://127.0.0.1:${address.port}/__cadflux/source/${sourceToken}`,
    resultUrl: `http://127.0.0.1:${address.port}/__cadflux/result/${resultToken}`,
    async close() {
      await rm(temporaryResultFilePath, { force: true }).catch(() => undefined)
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()))
      })
    },
    waitForResult() {
      return resultPromise
    }
  }
}

export function resolveContainedPath(
  rootDirectory: string,
  requestPath: string
): string | null {
  const canonicalRoot = realpathSync(rootDirectory)

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(requestPath)
  } catch {
    return null
  }

  if (decodedPath.includes('\0')) {
    return null
  }

  if (
    decodedPath.startsWith('\\\\') ||
    decodedPath.startsWith('//') ||
    /^[a-zA-Z]:/u.test(decodedPath)
  ) {
    return null
  }

  const normalizedPath = decodedPath.replace(/\\/g, '/')
  const relativePath =
    normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '')

  if (
    relativePath.length === 0 ||
    /^[a-zA-Z]:/u.test(relativePath) ||
    relativePath.startsWith('//')
  ) {
    return null
  }

  const candidatePath = path.resolve(canonicalRoot, relativePath)

  let canonicalCandidate: string
  try {
    canonicalCandidate = realpathSync(candidatePath)
  } catch {
    return null
  }

  const relative = path.relative(canonicalRoot, canonicalCandidate)
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    /^[a-zA-Z]:/u.test(relative) ||
    relative.startsWith('\\\\')
  ) {
    return null
  }

  try {
    const details = statSync(canonicalCandidate)
    if (!details.isFile()) {
      return null
    }
  } catch {
    return null
  }

  return canonicalCandidate
}

async function handleResultRequest(options: {
  request: NodeJS.ReadableStream & { destroy(error?: Error): void }
  requestMethod: string
  response: NodeJS.WritableStream & {
    end(chunk?: unknown): void
    setHeader(name: string, value: string): void
    writeHead(statusCode: number, headers?: Record<string, string>): void
  }
  resultFilePath: string
  resultMimeType: string
  temporaryResultFilePath: string
}): Promise<void> {
  if (options.requestMethod !== 'PUT' && options.requestMethod !== 'POST') {
    options.response.writeHead(405, { Allow: 'PUT, POST' })
    options.response.end()
    return
  }

  await mkdir(path.dirname(options.resultFilePath), { recursive: true })
  await rm(options.temporaryResultFilePath, { force: true }).catch(() => undefined)

  const writable = createWriteStream(options.temporaryResultFilePath, { flags: 'wx' })
  options.request.on('aborted', () => {
    writable.destroy(new Error('Bridge result upload disconnected.'))
  })

  try {
    await pipeline(options.request, writable)
    await rename(options.temporaryResultFilePath, options.resultFilePath)
    options.response.setHeader('Content-Type', options.resultMimeType)
    options.response.writeHead(201)
    options.response.end()
  } catch (error) {
    await rm(options.temporaryResultFilePath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function handleSourceRequest(options: {
  canonicalSourceFile: string
  request: NodeJS.ReadableStream
  requestMethod: string
  response: NodeJS.WritableStream & {
    end(chunk?: unknown): void
    setHeader(name: string, value: string): void
    writeHead(statusCode: number, headers?: Record<string, string>): void
  }
  tokenActive: boolean
}): Promise<void> {
  if (!options.tokenActive) {
    options.response.writeHead(404)
    options.response.end()
    return
  }

  if (options.requestMethod !== 'GET' && options.requestMethod !== 'HEAD') {
    options.response.writeHead(405, { Allow: 'GET, HEAD' })
    options.response.end()
    return
  }

  const details = await stat(options.canonicalSourceFile)
  options.response.setHeader('Content-Type', 'application/octet-stream')
  options.response.setHeader('Content-Length', String(details.size))

  if (options.requestMethod === 'HEAD') {
    options.response.writeHead(200)
    options.response.end()
    return
  }

  const stream = createReadStream(options.canonicalSourceFile)
  options.request.on('aborted', () => {
    stream.destroy()
  })

  await pipeline(stream, options.response)
}

function createOpaqueToken(): string {
  return randomBytes(24).toString('hex')
}

async function sendFileResponse(options: {
  filePath: string
  method: string
  request: NodeJS.ReadableStream
  response: NodeJS.WritableStream & {
    end(chunk?: unknown): void
    setHeader(name: string, value: string): void
    writeHead(statusCode: number, headers?: Record<string, string>): void
  }
}): Promise<void> {
  const details = await stat(options.filePath)
  const extension = path.extname(options.filePath).toLowerCase()
  options.response.setHeader(
    'Content-Type',
    ASSET_CONTENT_TYPES[extension] ?? 'application/octet-stream'
  )
  options.response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  )
  options.response.setHeader('Content-Length', String(details.size))

  if (options.method === 'HEAD') {
    options.response.writeHead(200)
    options.response.end()
    return
  }

  const stream = createReadStream(options.filePath)
  options.request.on('aborted', () => {
    stream.destroy()
  })
  await pipeline(stream, options.response)
}

function setBridgeHeaders(
  response: NodeJS.WritableStream & {
    setHeader(name: string, value: string): void
  }
): void {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
}
