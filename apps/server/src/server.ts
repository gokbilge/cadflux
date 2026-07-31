// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, constants, stat } from 'node:fs/promises'
import { rm } from 'node:fs/promises'
import path from 'node:path'

import {
  constantTimeTokenEquals,
  createSessionTokens,
  hashPassword,
  hashToken,
  normalizeUsername,
  validatePasswordStrength,
  verifyPassword
} from '@cadflux/auth'
import {
  API_PREFIX,
  AuthResponseSchema,
  ChangePasswordRequestSchema,
  CreateJobRequestSchema,
  JobFileListResponseSchema,
  JobFileResponseSchema,
  CreateProfileRequestSchema,
  CreateUserRequestSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  JobListResponseSchema,
  JobResponseSchema,
  LoginRequestSchema,
  ProfileListResponseSchema,
  ProfileResponseSchema,
  ResetPasswordRequestSchema,
  UpdateJobRequestSchema,
  UpdateProfileRequestSchema,
  UpdateUserRequestSchema,
  UserSchema,
  UserListResponseSchema
} from '@cadflux/contracts'
import type { JobDto, ProfileDto, Role, UserDto } from '@cadflux/contracts'
import type {
  CadFluxDatabase,
  StoredArtifact,
  StoredJobFile,
  StoredSession,
  StoredUser
} from '@cadflux/database'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { buildJobStoragePaths, sanitizeRelativePath, storeUploadStream } from '@cadflux/storage'
import { CADFLUX_PRESETS } from '@cadflux/presets'

import type { CadFluxServerConfig } from './config.js'
import type { JobEventBus } from './events.js'
import { generateJobReports } from './reports.js'
import type { ServerWorkerController } from './worker.js'

const SESSION_COOKIE_NAME = 'cadflux_session'
const CSRF_COOKIE_NAME = 'cadflux_csrf'

export interface BuildServerOptions {
  config: CadFluxServerConfig
  database: CadFluxDatabase
  events: JobEventBus
  worker: ServerWorkerController
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: StoredUser
    authSession?: StoredSession
  }
}

export async function buildServer(options: BuildServerOptions) {
  const app = Fastify({
    logger: {
      level: options.config.logLevel
    },
    trustProxy: options.config.trustProxy,
    bodyLimit: 1024 * 1024
  })

  await app.register(cookie, {
    secret: options.config.sessionSecret,
    parseOptions: {}
  })
  await app.register(rateLimit, {
    global: false
  })
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: options.config.maxFileSizeBytes
    }
  })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CadFlux API',
        version: '0.1.0'
      }
    }
  })

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error, requestId: _request.id }, 'cadflux.request_error')
    if (error instanceof ErrorResponse) {
      reply.code(reply.statusCode >= 400 ? reply.statusCode : 400).send({
        error: {
          code: error.code,
          message: error.publicMessage,
          requestId: _request.id
        }
      })
      return
    }
    reply.code(reply.statusCode >= 400 ? reply.statusCode : 500).send({
      error: {
        code: 'internal_error',
        message: 'An unexpected server error occurred.',
        requestId: _request.id
      }
    })
  })

  const webDistPath = path.resolve(process.cwd(), 'apps', 'web', 'dist')
  try {
    await access(webDistPath, constants.R_OK)
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/'
    })
  } catch {
    // Static build not available yet.
  }

  app.addHook('onRequest', async request => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME]
    if (!sessionToken) {
      return
    }
    const session = options.database.getSessionByTokenHash(hashToken(sessionToken))
    if (!session) {
      return
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      options.database.deleteSession(session.id)
      return
    }
    const user = options.database.getUserById(session.userId)
    if (!user || !user.isActive) {
      options.database.deleteSession(session.id)
      return
    }
    request.authUser = user
    request.authSession = session
    options.database.touchSession(session.id, new Date().toISOString())
  })

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Frame-Options', 'DENY')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'same-origin')
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"
    )
    return payload
  })

  app.get('/health/live', {
    schema: {
      response: {
        200: HealthResponseSchema
      }
    }
  }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks: {
      process: 'ok'
    }
  }))

  app.get('/health/ready', {
    schema: {
      response: {
        200: HealthResponseSchema
      }
    }
  }, async () => {
    const checks: Record<string, string> = {
      database: 'ok',
      storage: 'ok'
    }
    await access(options.config.dataDir, constants.W_OK)
    options.database.db.prepare('SELECT 1').get()
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      checks
    }
  })

  app.get(`${API_PREFIX}/openapi.json`, async () => app.swagger())

  app.post(`${API_PREFIX}/auth/login`, {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes'
      }
    },
    schema: {
      body: LoginRequestSchema,
      response: {
        200: AuthResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    const body = request.body as { username: string; password: string }
    const user = options.database.getUserByNormalizedUsername(
      normalizeUsername(body.username)
    )
    if (!user || !user.isActive) {
      reply.code(401)
      return invalidCredentials()
    }
    const passwordValid = await verifyPassword(body.password, user.passwordHash)
    if (!passwordValid) {
      reply.code(401)
      return invalidCredentials()
    }

    const tokens = createSessionTokens()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + options.config.sessionTtlHours * 60 * 60 * 1000)
    options.database.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(tokens.sessionToken),
      csrfTokenHash: hashToken(tokens.csrfToken),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: now.toISOString(),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    })
    options.database.updateUser(user.id, {
      updatedAt: now.toISOString(),
      lastLoginAt: now.toISOString()
    })
    setSessionCookies(reply, options.config, tokens, expiresAt)
    return {
      user: userToDto(
        options.database.getUserById(user.id) ?? user
      ),
      csrfToken: tokens.csrfToken,
      sessionExpiresAt: expiresAt.toISOString()
    }
  })

  app.post(`${API_PREFIX}/auth/logout`, {
    schema: {
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    if (request.authSession) {
      options.database.deleteSession(request.authSession.id)
    }
    clearSessionCookies(reply, options.config)
    return { ok: true }
  })

  app.get(`${API_PREFIX}/auth/me`, {
    schema: {
      response: {
        200: AuthResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const csrfToken = request.cookies[CSRF_COOKIE_NAME]
    return {
      user: userToDto(request.authUser!),
      csrfToken: csrfToken ?? '',
      sessionExpiresAt: request.authSession!.expiresAt
    }
  })

  app.post(`${API_PREFIX}/auth/change-password`, {
    schema: {
      body: ChangePasswordRequestSchema,
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const body = request.body as { currentPassword: string; newPassword: string }
    const valid = await verifyPassword(body.currentPassword, request.authUser!.passwordHash)
    if (!valid) {
      reply.code(401)
      return invalidCredentials()
    }
    const passwordError = validatePasswordStrength(body.newPassword)
    if (passwordError) {
      reply.code(400)
      return {
        error: {
          code: 'weak_password',
          message: passwordError
        }
      }
    }
    options.database.updateUser(request.authUser!.id, {
      passwordHash: await hashPassword(body.newPassword),
      updatedAt: new Date().toISOString()
    })
    options.database.deleteSessionsByUserId(request.authUser!.id)
    clearSessionCookies(reply, options.config)
    return { ok: true }
  })

  app.get(`${API_PREFIX}/admin/users`, {
    schema: {
      response: {
        200: UserListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAdmin(request, reply)
    return {
      users: options.database.listUsers().map(userToDto)
    }
  })

  app.post(`${API_PREFIX}/admin/users`, {
    schema: {
      body: CreateUserRequestSchema,
      response: {
        200: Type.Object({ user: UserSchema }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAdmin(request, reply)
    verifyCsrf(request, reply)
    const body = request.body as {
      username: string
      password: string
      role: Role
      isActive?: boolean
    }
    const passwordError = validatePasswordStrength(body.password)
    if (passwordError) {
      reply.code(400)
      return {
        error: {
          code: 'weak_password',
          message: passwordError
        }
      }
    }
    const normalizedUsername = normalizeUsername(body.username)
    if (options.database.getUserByNormalizedUsername(normalizedUsername)) {
      reply.code(409)
      return {
        error: {
          code: 'username_taken',
          message: 'Username already exists.'
        }
      }
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    options.database.createUser({
      id,
      username: body.username.trim(),
      normalizedUsername,
      passwordHash: await hashPassword(body.password),
      role: body.role,
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now
    })
    return {
      user: userToDto(options.database.getUserById(id)!)
    }
  })

  app.patch(`${API_PREFIX}/admin/users/:id`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: UpdateUserRequestSchema,
      response: {
        200: Type.Object({ user: UserSchema }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAdmin(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { id: string }
    const user = options.database.getUserById(params.id)
    if (!user) {
      reply.code(404)
      return notFound('user_not_found', 'User not found.')
    }
    options.database.updateUser(user.id, {
      ...(request.body as { role?: Role; isActive?: boolean }),
      updatedAt: new Date().toISOString()
    })
    if ((request.body as { isActive?: boolean }).isActive === false) {
      options.database.deleteSessionsByUserId(user.id)
    }
    return {
      user: userToDto(options.database.getUserById(user.id)!)
    }
  })

  app.post(`${API_PREFIX}/admin/users/:id/reset-password`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: ResetPasswordRequestSchema,
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAdmin(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { id: string }
    const user = options.database.getUserById(params.id)
    if (!user) {
      reply.code(404)
      return notFound('user_not_found', 'User not found.')
    }
    const body = request.body as { newPassword: string }
    const passwordError = validatePasswordStrength(body.newPassword)
    if (passwordError) {
      reply.code(400)
      return {
        error: {
          code: 'weak_password',
          message: passwordError
        }
      }
    }
    options.database.updateUser(user.id, {
      passwordHash: await hashPassword(body.newPassword),
      updatedAt: new Date().toISOString()
    })
    options.database.deleteSessionsByUserId(user.id)
    return { ok: true }
  })

  app.delete(`${API_PREFIX}/admin/users/:id`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAdmin(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { id: string }
    const user = options.database.getUserById(params.id)
    if (!user) {
      reply.code(404)
      return notFound('user_not_found', 'User not found.')
    }
    if (options.database.countUsers() <= 1) {
      reply.code(403)
      return {
        error: {
          code: 'last_user_protected',
          message: 'Cannot delete the last remaining user.'
        }
      }
    }
    options.database.deleteSessionsByUserId(user.id)
    options.database.deleteUser(user.id)
    return { ok: true }
  })

  app.get(`${API_PREFIX}/jobs`, {
    schema: {
      response: {
        200: JobListResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const jobs =
      request.authUser!.role === 'admin'
        ? options.database.listAllJobs()
        : options.database.listJobsByUser(request.authUser!.id)
    return {
      jobs: jobs.map(jobToDto)
    }
  })

  app.post(`${API_PREFIX}/jobs`, {
    schema: {
      body: CreateJobRequestSchema,
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const body = request.body as { name: string; profileJson: string }
    const now = new Date().toISOString()
    const id = randomUUID()
    options.database.createJob({
      id,
      userId: request.authUser!.id,
      status: 'draft',
      name: body.name.trim(),
      profileJson: body.profileJson,
      totalFiles: 0,
      completedFiles: 0,
      warningFiles: 0,
      failedFiles: 0,
      cancelledFiles: 0,
      progressPercent: 0,
      createdAt: now,
      version: '0.1.0'
    })
    return {
      job: jobToDto(options.database.getJobById(id)!)
    }
  })

  app.get(`${API_PREFIX}/jobs/:jobId`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    return { job: jobToDto(job) }
  })

  app.patch(`${API_PREFIX}/jobs/:jobId`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      body: UpdateJobRequestSchema,
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    const body = request.body as { name?: string; profileJson?: string }
    options.database.updateJob(job.id, {
      name: body.name?.trim(),
      profileJson: body.profileJson
    })
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.delete(`${API_PREFIX}/jobs/:jobId`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    options.database.deleteJob(job.id)
    return { ok: true }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/start`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    if (options.database.listJobFiles(job.id).length === 0) {
      reply.code(400)
      return {
        error: {
          code: 'job_has_no_files',
          message: 'Upload at least one file before starting the job.'
        }
      }
    }
    const now = new Date().toISOString()
    options.database.updateJob(job.id, {
      status: 'queued',
      queuedAt: now,
      progressPercent: 0
    })
    options.events.publish(job.id, 'job.queued', {
      jobId: job.id,
      queuedAt: now
    })
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/pause`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    options.worker.pauseJob(job.id)
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/resume`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    options.worker.resumeJob(job.id)
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/cancel`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    options.worker.cancelJob(job.id)
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/retry`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    options.worker.retryJob(job.id)
    return { job: jobToDto(options.database.getJobById(job.id)!) }
  })

  app.get(`${API_PREFIX}/jobs/:jobId/events`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    const lastEventId = request.headers['last-event-id']
    const sinceId = Array.isArray(lastEventId) ? lastEventId[0] : lastEventId

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    })

    const writeEvent = (event: ReturnType<JobEventBus['publish']>) => {
      reply.raw.write(`id: ${event.id}\n`)
      reply.raw.write(`event: ${event.type}\n`)
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    for (const event of options.events.list(job.id, sinceId)) {
      writeEvent(event)
    }

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n')
    }, 15000)
    const unsubscribe = options.events.subscribe(job.id, writeEvent)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  app.get(`${API_PREFIX}/jobs/:jobId/files`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: JobFileListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    return {
      files: options.database.listJobFiles(job.id).map(jobFileToDto)
    }
  })

  app.get(`${API_PREFIX}/jobs/:jobId/files/:fileId`, {
    schema: {
      params: Type.Object({ jobId: Type.String(), fileId: Type.String() }),
      response: {
        200: JobFileResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string; fileId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    const file = requireOwnedJobFile(options.database, reply, job, params.fileId)
    return { file: jobFileToDto(file) }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/files`, {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    if (!['draft', 'uploading'].includes(job.status)) {
      reply.code(409)
      return {
        error: {
          code: 'job_upload_closed',
          message: 'Uploads are only allowed while the job is in draft or uploading state.'
        }
      }
    }
    const currentFiles = options.database.listJobFiles(job.id)
    if (currentFiles.length >= options.config.maxFilesPerJob) {
      reply.code(400)
      return {
        error: {
          code: 'job_file_limit_exceeded',
          message: 'This job already reached the maximum file count.'
        }
      }
    }

    const filePart = await request.file()
    if (!filePart) {
      reply.code(400)
      return {
        error: {
          code: 'file_missing',
          message: 'Upload requires one DWG or DXF file.'
        }
      }
    }

    const relativePathField = filePart.fields.relativePath
    const relativePathValue =
      relativePathField && !Array.isArray(relativePathField) && 'value' in relativePathField
        ? relativePathField.value
        : undefined
    const providedRelativePath =
      typeof relativePathValue === 'string' && relativePathValue.trim().length > 0
        ? relativePathValue
        : filePart.filename
    const safeRelativePath = sanitizeRelativePath(providedRelativePath)
    if (currentFiles.some(file => file.relativePath === safeRelativePath)) {
      reply.code(409)
      return {
        error: {
          code: 'duplicate_relative_path',
          message: 'A file with the same relative path already exists in this job.'
        }
      }
    }
    const stored = await storeUploadStream({
      dataDir: options.config.dataDir,
      jobId: job.id,
      relativePath: safeRelativePath,
      originalName: filePart.filename,
      stream: filePart.file
    })
    const totalSizeBytes =
      currentFiles.reduce((sum, file) => sum + file.sizeBytes, 0) + stored.sizeBytes
    if (totalSizeBytes > options.config.maxJobSizeBytes) {
      await rm(stored.storedPath, { force: true }).catch(() => undefined)
      reply.code(400)
      return {
        error: {
          code: 'job_size_limit_exceeded',
          message: 'This job exceeds the maximum total upload size.'
        }
      }
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    options.database.createJobFile({
      id,
      jobId: job.id,
      originalName: filePart.filename,
      relativePath: stored.relativePath,
      storedPath: stored.storedPath,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      format: stored.format,
      status: 'ready',
      progressPercent: 0,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now
    })
    const totalFiles = options.database.listJobFiles(job.id).length
    options.database.updateJob(job.id, {
      totalFiles,
      status: job.status === 'draft' ? 'uploading' : job.status
    })

    return {
      file: jobFileToDto(options.database.getJobFileById(id)!)
    }
  })

  app.delete(`${API_PREFIX}/jobs/:jobId/files/:fileId`, {
    schema: {
      params: Type.Object({ jobId: Type.String(), fileId: Type.String() }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string; fileId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    const file = requireOwnedJobFile(options.database, reply, job, params.fileId)
    const storageRoot = buildJobStoragePaths(options.config.dataDir, job.id).jobRoot
    if (isDescendantPath(file.storedPath, storageRoot)) {
      await rm(file.storedPath, { force: true }).catch(() => undefined)
    }
    options.database.deleteJobFile(file.id)
    options.database.updateJob(job.id, {
      totalFiles: Math.max(0, options.database.listJobFiles(job.id).length)
    })
    return { ok: true }
  })

  app.get(`${API_PREFIX}/jobs/:jobId/artifacts`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: Type.Object({
          artifacts: Type.Array(Type.Object({
            id: Type.String(),
            jobId: Type.String(),
            jobFileId: Type.Optional(Type.String()),
            type: Type.String(),
            format: Type.String(),
            relativePath: Type.String(),
            sizeBytes: Type.Number(),
            checksum: Type.String(),
            mimeType: Type.String(),
            fidelity: Type.String(),
            createdAt: Type.String()
          }))
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    return {
      artifacts: options.database.listArtifactsByJob(job.id).map(artifactToDto)
    }
  })

  app.post(`${API_PREFIX}/jobs/:jobId/reports`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: Type.Object({
          artifacts: Type.Array(Type.Object({
            id: Type.String(),
            jobId: Type.String(),
            jobFileId: Type.Optional(Type.String()),
            type: Type.String(),
            format: Type.String(),
            relativePath: Type.String(),
            sizeBytes: Type.Number(),
            checksum: Type.String(),
            mimeType: Type.String(),
            fidelity: Type.String(),
            createdAt: Type.String()
          }))
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    const created = await generateJobReports({
      database: options.database,
      dataDir: options.config.dataDir,
      job
    })
    options.events.publish(job.id, 'artifact.created', {
      jobId: job.id,
      reportCount: created.length
    })
    return {
      artifacts: created.map(artifactToDto)
    }
  })

  app.get(`${API_PREFIX}/jobs/:jobId/reports`, {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: Type.Object({
          artifacts: Type.Array(Type.Object({
            id: Type.String(),
            jobId: Type.String(),
            jobFileId: Type.Optional(Type.String()),
            type: Type.String(),
            format: Type.String(),
            relativePath: Type.String(),
            sizeBytes: Type.Number(),
            checksum: Type.String(),
            mimeType: Type.String(),
            fidelity: Type.String(),
            createdAt: Type.String()
          }))
        }),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { jobId: string }
    const job = requireOwnedJob(options.database, request, reply, params.jobId)
    return {
      artifacts: options.database
        .listArtifactsByJob(job.id)
        .filter(artifact =>
          ['json_report', 'csv_report', 'html_report', 'manifest', 'zip'].includes(artifact.type)
        )
        .map(artifactToDto)
    }
  })

  app.get(`${API_PREFIX}/artifacts/:artifactId/download`, {
    schema: {
      params: Type.Object({ artifactId: Type.String() }),
      response: {
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { artifactId: string }
    const artifact = requireOwnedArtifact(options.database, request, reply, params.artifactId)
    const details = await stat(artifact.storedPath)
    reply.header('Content-Type', artifact.mimeType)
    reply.header(
      'Content-Disposition',
      `attachment; filename="${path.basename(artifact.relativePath).replace(/"/g, '')}"`
    )
    reply.header('Content-Length', String(details.size))
    return reply.send(createReadStream(artifact.storedPath))
  })

  app.get(`${API_PREFIX}/profiles`, {
    schema: {
      response: {
        200: ProfileListResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const profiles =
      request.authUser!.role === 'admin'
        ? options.database.listAllProfiles()
        : options.database.listProfiles(request.authUser!.id)
    return { profiles: profiles.map(profileToDto) }
  })

  app.post(`${API_PREFIX}/profiles`, {
    schema: {
      body: CreateProfileRequestSchema,
      response: {
        200: ProfileResponseSchema,
        401: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const body = request.body as {
      name: string
      description: string
      profileJson: string
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    options.database.createProfile({
      id,
      userId: request.authUser!.id,
      name: body.name.trim(),
      description: body.description.trim(),
      profileJson: body.profileJson,
      isSystem: false,
      createdAt: now,
      updatedAt: now
    })
    return { profile: profileToDto(options.database.getProfileById(id)!) }
  })

  app.get(`${API_PREFIX}/profiles/:id`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: ProfileResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    const params = request.params as { id: string }
    const profile = requireOwnedProfile(options.database, request, reply, params.id)
    return { profile: profileToDto(profile) }
  })

  app.patch(`${API_PREFIX}/profiles/:id`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: UpdateProfileRequestSchema,
      response: {
        200: ProfileResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { id: string }
    const profile = requireOwnedProfile(options.database, request, reply, params.id)
    const body = request.body as {
      name?: string
      description?: string
      profileJson?: string
    }
    options.database.updateProfile(profile.id, {
      name: body.name?.trim(),
      description: body.description?.trim(),
      profileJson: body.profileJson,
      updatedAt: new Date().toISOString()
    })
    return {
      profile: profileToDto(options.database.getProfileById(profile.id)!)
    }
  })

  app.delete(`${API_PREFIX}/profiles/:id`, {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ ok: Type.Boolean() }),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema
      }
    }
  }, async (request, reply) => {
    requireAuth(request, reply)
    verifyCsrf(request, reply)
    const params = request.params as { id: string }
    const profile = requireOwnedProfile(options.database, request, reply, params.id)
    if (profile.isSystem) {
      reply.code(403)
      return {
        error: {
          code: 'system_profile_protected',
          message: 'System profiles cannot be deleted.'
        }
      }
    }
    options.database.deleteProfile(profile.id)
    return { ok: true }
  })

  return app
}

export async function bootstrapAdminUser(
  database: CadFluxDatabase,
  config: CadFluxServerConfig
): Promise<void> {
  ensureSystemProfiles(database)
  if (database.countUsers() > 0) {
    return
  }
  if (!config.adminUsername || !config.adminPassword) {
    return
  }
  const passwordError = validatePasswordStrength(config.adminPassword)
  if (passwordError) {
    throw new Error(`Initial admin password is not acceptable. ${passwordError}`)
  }
  const now = new Date().toISOString()
  database.createUser({
    id: randomUUID(),
    username: config.adminUsername.trim(),
    normalizedUsername: normalizeUsername(config.adminUsername),
    passwordHash: await hashPassword(config.adminPassword),
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now
  })
}

export function userToDto(user: StoredUser): UserDto {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  }
}

function ensureSystemProfiles(database: CadFluxDatabase): void {
  const existing = database.listAllProfiles()
  const existingIds = new Set(existing.map(profile => profile.id))
  const now = new Date().toISOString()
  for (const preset of CADFLUX_PRESETS) {
    const id = `system:${preset.id}`
    if (existingIds.has(id)) {
      continue
    }
    database.createProfile({
      id,
      name: preset.label,
      description: `System preset ${preset.id}`,
      profileJson: JSON.stringify(preset),
      isSystem: true,
      createdAt: now,
      updatedAt: now
    })
  }
}

function requireAuth(request: FastifyRequest, reply: FastifyReply): void {
  if (!request.authUser || !request.authSession) {
    reply.code(401)
    throw new ErrorResponse('not_authenticated', 'Authentication required.')
  }
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply): void {
  requireAuth(request, reply)
  if (request.authUser?.role !== 'admin') {
    reply.code(403)
    throw new ErrorResponse('forbidden', 'Administrator access required.')
  }
}

function verifyCsrf(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const cookieValue = request.cookies[CSRF_COOKIE_NAME]
  const headerValue = request.headers['x-csrf-token']
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue
  if (!cookieValue || !headerToken || !request.authSession) {
    reply.code(403)
    throw new ErrorResponse('csrf_invalid', 'CSRF token is missing or invalid.')
  }
  const cookieHash = hashToken(cookieValue)
  const headerHash = hashToken(headerToken)
  if (
    !constantTimeTokenEquals(cookieHash, headerHash) ||
    !constantTimeTokenEquals(cookieHash, request.authSession.csrfTokenHash)
  ) {
    reply.code(403)
    throw new ErrorResponse('csrf_invalid', 'CSRF token is missing or invalid.')
  }
}

function setSessionCookies(
  reply: FastifyReply,
  config: CadFluxServerConfig,
  tokens: { sessionToken: string; csrfToken: string },
  expiresAt: Date
): void {
  reply.setCookie(SESSION_COOKIE_NAME, tokens.sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: expiresAt
  })
  reply.setCookie(CSRF_COOKIE_NAME, tokens.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: expiresAt
  })
}

function clearSessionCookies(
  reply: FastifyReply,
  config: CadFluxServerConfig
): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/'
  })
  reply.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/'
  })
}

function invalidCredentials() {
  return {
    error: {
      code: 'invalid_credentials',
      message: 'Invalid credentials.'
    }
  }
}

function notFound(code: string, message: string) {
  return {
    error: {
      code,
      message
    }
  }
}

function requireOwnedJob(
  database: CadFluxDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  jobId: string
) {
  const job = database.getJobById(jobId)
  if (!job) {
    reply.code(404)
    throw new ErrorResponse('job_not_found', 'Job not found.')
  }
  if (request.authUser!.role !== 'admin' && job.userId !== request.authUser!.id) {
    reply.code(404)
    throw new ErrorResponse('job_not_found', 'Job not found.')
  }
  return job
}

function requireOwnedProfile(
  database: CadFluxDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  profileId: string
) {
  const profile = database.getProfileById(profileId)
  if (!profile) {
    reply.code(404)
    throw new ErrorResponse('profile_not_found', 'Profile not found.')
  }
  if (
    request.authUser!.role !== 'admin' &&
    !profile.isSystem &&
    profile.userId !== request.authUser!.id
  ) {
    reply.code(404)
    throw new ErrorResponse('profile_not_found', 'Profile not found.')
  }
  return profile
}

function requireOwnedArtifact(
  database: CadFluxDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  artifactId: string
) {
  const artifact = database.getArtifactById(artifactId)
  if (!artifact) {
    reply.code(404)
    throw new ErrorResponse('artifact_not_found', 'Artifact not found.')
  }
  const job = database.getJobById(artifact.jobId)
  if (!job) {
    reply.code(404)
    throw new ErrorResponse('artifact_not_found', 'Artifact not found.')
  }
  if (request.authUser!.role !== 'admin' && job.userId !== request.authUser!.id) {
    reply.code(404)
    throw new ErrorResponse('artifact_not_found', 'Artifact not found.')
  }
  return artifact
}

function requireOwnedJobFile(
  database: CadFluxDatabase,
  reply: FastifyReply,
  job: ReturnType<CadFluxDatabase['getJobById']> extends infer T ? Exclude<T, null> : never,
  fileId: string
) {
  const file = database.getJobFileById(fileId)
  if (!file || file.jobId !== job.id) {
    reply.code(404)
    throw new ErrorResponse('job_file_not_found', 'Job file not found.')
  }
  return file
}

function jobToDto(job: ReturnType<CadFluxDatabase['getJobById']> extends infer T ? Exclude<T, null> : never): JobDto {
  return {
    id: job.id,
    userId: job.userId,
    name: job.name,
    status: job.status as JobDto['status'],
    profileJson: job.profileJson,
    totalFiles: job.totalFiles,
    completedFiles: job.completedFiles,
    warningFiles: job.warningFiles,
    failedFiles: job.failedFiles,
    cancelledFiles: job.cancelledFiles,
    progressPercent: job.progressPercent,
    createdAt: job.createdAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    cancelRequestedAt: job.cancelRequestedAt,
    errorSummary: job.errorSummary,
    version: job.version
  }
}

function jobFileToDto(file: StoredJobFile) {
  return {
    id: file.id,
    jobId: file.jobId,
    originalName: file.originalName,
    relativePath: file.relativePath,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    format: file.format,
    status: file.status as
      | 'pending'
      | 'ready'
      | 'claimed'
      | 'parsing'
      | 'rendering'
      | 'exporting'
      | 'completed'
      | 'completed_with_warnings'
      | 'failed'
      | 'cancelled'
      | 'skipped',
    progressPercent: file.progressPercent,
    attemptCount: file.attemptCount,
    maxAttempts: file.maxAttempts,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    errorCode: file.errorCode,
    errorMessage: file.errorMessage
  }
}

function artifactToDto(artifact: StoredArtifact) {
  return {
    id: artifact.id,
    jobId: artifact.jobId,
    jobFileId: artifact.jobFileId,
    type: artifact.type,
    format: artifact.format,
    relativePath: artifact.relativePath,
    sizeBytes: artifact.sizeBytes,
    checksum: artifact.checksum,
    mimeType: artifact.mimeType,
    fidelity: artifact.fidelity,
    createdAt: artifact.createdAt
  }
}

function profileToDto(profile: ReturnType<CadFluxDatabase['getProfileById']> extends infer T ? Exclude<T, null> : never): ProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    description: profile.description,
    profileJson: profile.profileJson,
    isSystem: profile.isSystem,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  }
}

function isDescendantPath(targetPath: string, parentPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedParent = path.resolve(parentPath)
  const relative = path.relative(resolvedParent, resolvedTarget)
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)
}

class ErrorResponse extends Error {
  constructor(
    readonly code: string,
    readonly publicMessage: string
  ) {
    super(publicMessage)
  }
}
