// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { accessSync, constants, mkdirSync } from 'node:fs'
import path from 'node:path'

export interface CadFluxServerConfig {
  host: string
  port: number
  baseUrl: string
  dataDir: string
  databasePath: string
  sessionSecret: string
  secureCookies: boolean
  trustProxy: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  adminUsername?: string
  adminPassword?: string
  sessionTtlHours: number
  maxFileSizeBytes: number
  maxFilesPerJob: number
  workerConcurrency: number
  conversionTimeoutMs: number
  retryBackoffMs: number
  staleClaimMinutes: number
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env
): CadFluxServerConfig {
  const host = environment.CADFLUX_HOST ?? '0.0.0.0'
  const port = Number(environment.CADFLUX_PORT ?? '8080')
  const dataDir = path.resolve(environment.CADFLUX_DATA_DIR ?? './data')
  const databasePath = path.resolve(
    environment.CADFLUX_DATABASE_PATH ?? path.join(dataDir, 'database', 'cadflux.sqlite')
  )
  const baseUrl = environment.CADFLUX_BASE_URL ?? `http://localhost:${port}`
  const sessionSecret = environment.CADFLUX_SESSION_SECRET ?? 'development-session-secret-change-me'
  const secureCookies = parseBoolean(
    environment.CADFLUX_SECURE_COOKIES,
    baseUrl.startsWith('https://')
  )
  const trustProxy = parseBoolean(environment.CADFLUX_TRUST_PROXY, false)
  const logLevel = parseLogLevel(environment.CADFLUX_LOG_LEVEL)

  const config: CadFluxServerConfig = {
    host,
    port,
    baseUrl,
    dataDir,
    databasePath,
    sessionSecret,
    secureCookies,
    trustProxy,
    logLevel,
    adminUsername: environment.CADFLUX_ADMIN_USERNAME,
    adminPassword: environment.CADFLUX_ADMIN_PASSWORD,
    sessionTtlHours: 24,
    maxFileSizeBytes: Number(environment.CADFLUX_MAX_FILE_SIZE ?? String(250 * 1024 * 1024)),
    maxFilesPerJob: Number(environment.CADFLUX_MAX_FILES_PER_JOB ?? '500'),
    workerConcurrency: Number(environment.CADFLUX_WORKER_CONCURRENCY ?? '1'),
    conversionTimeoutMs: Number(environment.CADFLUX_CONVERSION_TIMEOUT_MS ?? '300000'),
    retryBackoffMs: Number(environment.CADFLUX_RETRY_BACKOFF_MS ?? '15000'),
    staleClaimMinutes: Number(environment.CADFLUX_STALE_CLAIM_MINUTES ?? '10')
  }

  validateServerConfig(config)
  return config
}

export function validateServerConfig(config: CadFluxServerConfig): void {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('CADFLUX_PORT must be a valid TCP port.')
  }
  if (!Number.isInteger(config.maxFileSizeBytes) || config.maxFileSizeBytes <= 0) {
    throw new Error('CADFLUX_MAX_FILE_SIZE must be a positive integer.')
  }
  if (!Number.isInteger(config.maxFilesPerJob) || config.maxFilesPerJob <= 0) {
    throw new Error('CADFLUX_MAX_FILES_PER_JOB must be a positive integer.')
  }
  if (!Number.isInteger(config.workerConcurrency) || config.workerConcurrency <= 0) {
    throw new Error('CADFLUX_WORKER_CONCURRENCY must be a positive integer.')
  }
  if (!Number.isInteger(config.conversionTimeoutMs) || config.conversionTimeoutMs <= 0) {
    throw new Error('CADFLUX_CONVERSION_TIMEOUT_MS must be a positive integer.')
  }
  if (!Number.isInteger(config.retryBackoffMs) || config.retryBackoffMs < 0) {
    throw new Error('CADFLUX_RETRY_BACKOFF_MS must be a non-negative integer.')
  }
  if (!Number.isInteger(config.staleClaimMinutes) || config.staleClaimMinutes <= 0) {
    throw new Error('CADFLUX_STALE_CLAIM_MINUTES must be a positive integer.')
  }
  if (config.sessionSecret.length < 24) {
    throw new Error('CADFLUX_SESSION_SECRET must be at least 24 characters long.')
  }

  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(path.dirname(config.databasePath), { recursive: true })
  accessSync(config.dataDir, constants.W_OK)
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function parseLogLevel(
  value: string | undefined
): CadFluxServerConfig['logLevel'] {
  if (value === 'error' || value === 'warn' || value === 'info' || value === 'debug') {
    return value
  }
  return 'info'
}
