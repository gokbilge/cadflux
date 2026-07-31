// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdirSync } from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

import type { Role } from '@cadflux/contracts'

export interface CadFluxDatabaseConfig {
  databasePath: string
}

export interface StoredUser {
  id: string
  username: string
  normalizedUsername: string
  passwordHash: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export interface StoredSession {
  id: string
  userId: string
  tokenHash: string
  csrfTokenHash: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  ipAddress?: string
  userAgent?: string
}

export interface CreateUserInput {
  id: string
  username: string
  normalizedUsername: string
  passwordHash: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateUserInput {
  role?: Role
  isActive?: boolean
  passwordHash?: string
  updatedAt: string
  lastLoginAt?: string
}

export interface CreateSessionInput {
  id: string
  userId: string
  tokenHash: string
  csrfTokenHash: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  ipAddress?: string
  userAgent?: string
}

export interface StoredJob {
  id: string
  userId: string
  status: string
  name: string
  profileJson: string
  totalFiles: number
  completedFiles: number
  warningFiles: number
  failedFiles: number
  cancelledFiles: number
  progressPercent: number
  createdAt: string
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  cancelRequestedAt?: string
  errorSummary?: string
  version: string
}

export interface CreateJobInput {
  id: string
  userId: string
  status: string
  name: string
  profileJson: string
  totalFiles: number
  completedFiles: number
  warningFiles: number
  failedFiles: number
  cancelledFiles: number
  progressPercent: number
  createdAt: string
  version: string
}

export interface UpdateJobInput {
  status?: string
  name?: string
  profileJson?: string
  totalFiles?: number
  completedFiles?: number
  warningFiles?: number
  failedFiles?: number
  cancelledFiles?: number
  progressPercent?: number
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  cancelRequestedAt?: string
  errorSummary?: string
}

export interface StoredProfile {
  id: string
  userId?: string
  name: string
  description: string
  profileJson: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProfileInput {
  id: string
  userId?: string
  name: string
  description: string
  profileJson: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileInput {
  name?: string
  description?: string
  profileJson?: string
  updatedAt: string
}

export interface StoredJobFile {
  id: string
  jobId: string
  originalName: string
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  format: string
  detectedVersion?: string
  status: string
  progressPercent: number
  attemptCount: number
  maxAttempts: number
  nextAttemptAt?: string
  workerId?: string
  claimedAt?: string
  startedAt?: string
  completedAt?: string
  errorCode?: string
  errorMessage?: string
  diagnosticsJson?: string
  resultSummaryJson?: string
  createdAt: string
  updatedAt: string
}

export interface CreateJobFileInput {
  id: string
  jobId: string
  originalName: string
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  format: string
  status: string
  progressPercent: number
  attemptCount: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

export interface UpdateJobFileInput {
  status?: string
  progressPercent?: number
  attemptCount?: number
  maxAttempts?: number
  nextAttemptAt?: string
  workerId?: string
  claimedAt?: string
  startedAt?: string
  completedAt?: string
  errorCode?: string
  errorMessage?: string
  diagnosticsJson?: string
  resultSummaryJson?: string
  updatedAt: string
}

export interface RecoverClaimedJobFilesResult {
  recoveredFileIds: string[]
}

export interface StoredArtifact {
  id: string
  jobId: string
  jobFileId?: string
  type: string
  format: string
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  mimeType: string
  fidelity: string
  createdAt: string
}

export interface CreateArtifactInput {
  id: string
  jobId: string
  jobFileId?: string
  type: string
  format: string
  relativePath: string
  storedPath: string
  sizeBytes: number
  checksum: string
  mimeType: string
  fidelity: string
  createdAt: string
}

type BetterSqliteDatabase = Database.Database

export interface CadFluxDatabase {
  db: BetterSqliteDatabase
  close(): void
  runMigrations(): void
  countUsers(): number
  createUser(input: CreateUserInput): void
  listUsers(): StoredUser[]
  getUserById(id: string): StoredUser | null
  getUserByNormalizedUsername(normalizedUsername: string): StoredUser | null
  updateUser(id: string, input: UpdateUserInput): void
  deleteUser(id: string): void
  createSession(input: CreateSessionInput): void
  getSessionByTokenHash(tokenHash: string): StoredSession | null
  deleteSession(id: string): void
  deleteExpiredSessions(nowIso: string): number
  deleteSessionsByUserId(userId: string): number
  touchSession(id: string, lastSeenAt: string): void
  createJob(input: CreateJobInput): void
  listJobsByUser(userId: string): StoredJob[]
  listAllJobs(): StoredJob[]
  getJobById(id: string): StoredJob | null
  updateJob(id: string, input: UpdateJobInput): void
  deleteJob(id: string): void
  createProfile(input: CreateProfileInput): void
  listProfiles(userId: string): StoredProfile[]
  listAllProfiles(): StoredProfile[]
  getProfileById(id: string): StoredProfile | null
  updateProfile(id: string, input: UpdateProfileInput): void
  deleteProfile(id: string): void
  createJobFile(input: CreateJobFileInput): void
  listJobFiles(jobId: string): StoredJobFile[]
  getJobFileById(id: string): StoredJobFile | null
  claimNextJobFile(workerId: string, nowIso: string): StoredJobFile | null
  updateJobFile(id: string, input: UpdateJobFileInput): void
  cancelPendingJobFiles(jobId: string, nowIso: string): number
  resetFailedJobFiles(jobId: string, nowIso: string): number
  recoverStaleClaimedJobFiles(staleBeforeIso: string, nowIso: string): RecoverClaimedJobFilesResult
  deleteJobFile(id: string): void
  createArtifact(input: CreateArtifactInput): void
  listArtifactsByJob(jobId: string): StoredArtifact[]
  getArtifactById(id: string): StoredArtifact | null
  deleteArtifact(id: string): void
}

const MIGRATIONS: Array<{ id: string; sql: string[] }> = [
  {
    id: '20260731_0001_initial',
    sql: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        normalized_username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        ip_address_optional TEXT,
        user_agent_optional TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        name TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        total_files INTEGER NOT NULL DEFAULT 0,
        completed_files INTEGER NOT NULL DEFAULT 0,
        warning_files INTEGER NOT NULL DEFAULT 0,
        failed_files INTEGER NOT NULL DEFAULT 0,
        cancelled_files INTEGER NOT NULL DEFAULT 0,
        progress_percent REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        queued_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        cancel_requested_at TEXT,
        error_summary TEXT,
        version TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_user_id_created_at ON jobs(user_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS job_files (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        format TEXT NOT NULL,
        detected_version TEXT,
        status TEXT NOT NULL,
        progress_percent REAL NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TEXT,
        worker_id TEXT,
        claimed_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        error_code TEXT,
        error_message TEXT,
        diagnostics_json TEXT,
        result_summary_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_job_files_job_id_status ON job_files(job_id, status)`,
      `CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_file_id_optional TEXT,
        type TEXT NOT NULL,
        format TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        fidelity TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (job_file_id_optional) REFERENCES job_files(id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id)`,
      `CREATE TABLE IF NOT EXISTS diagnostics (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_file_id_optional TEXT,
        severity TEXT NOT NULL,
        code TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (job_file_id_optional) REFERENCES job_files(id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_diagnostics_job_id ON diagnostics(job_id)`,
      `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id_optional TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id_optional) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_profiles_user_id_optional ON profiles(user_id_optional)`,
      `CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        current_job_file_id TEXT,
        last_heartbeat_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    ]
  }
]

export function openCadFluxDatabase(
  config: CadFluxDatabaseConfig
): CadFluxDatabase {
  mkdirSync(path.dirname(config.databasePath), { recursive: true })
  const db = new Database(config.databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  const api: CadFluxDatabase = {
    db,
    close() {
      db.close()
    },
    runMigrations() {
      runMigrations(db)
    },
    countUsers() {
      const row = db
        .prepare('SELECT COUNT(*) AS count FROM users')
        .get() as { count: number }
      return row.count
    },
    createUser(input) {
      db.prepare(
        `INSERT INTO users (
          id, username, normalized_username, password_hash, role, is_active, created_at, updated_at
        ) VALUES (
          @id, @username, @normalizedUsername, @passwordHash, @role, @isActive, @createdAt, @updatedAt
        )`
      ).run({
        ...input,
        isActive: input.isActive ? 1 : 0
      })
    },
    listUsers() {
      return mapUsers(
        db.prepare(
          `SELECT id, username, normalized_username, password_hash, role, is_active, created_at, updated_at, last_login_at
           FROM users
           ORDER BY normalized_username ASC`
        ).all()
      )
    },
    getUserById(id) {
      return (
        mapUsers(
          db.prepare(
            `SELECT id, username, normalized_username, password_hash, role, is_active, created_at, updated_at, last_login_at
             FROM users
             WHERE id = ?`
          ).all(id)
        )[0] ?? null
      )
    },
    getUserByNormalizedUsername(normalizedUsername) {
      return (
        mapUsers(
          db.prepare(
            `SELECT id, username, normalized_username, password_hash, role, is_active, created_at, updated_at, last_login_at
             FROM users
             WHERE normalized_username = ?`
          ).all(normalizedUsername)
        )[0] ?? null
      )
    },
    updateUser(id, input) {
      const current = api.getUserById(id)
      if (!current) {
        return
      }
      db.prepare(
        `UPDATE users
         SET password_hash = @passwordHash,
             role = @role,
             is_active = @isActive,
             updated_at = @updatedAt,
             last_login_at = @lastLoginAt
         WHERE id = @id`
      ).run({
        id,
        passwordHash: input.passwordHash ?? current.passwordHash,
        role: input.role ?? current.role,
        isActive: (input.isActive ?? current.isActive) ? 1 : 0,
        updatedAt: input.updatedAt,
        lastLoginAt: input.lastLoginAt ?? current.lastLoginAt ?? null
      })
    },
    deleteUser(id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(id)
    },
    createSession(input) {
      db.prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, csrf_token_hash, created_at, expires_at, last_seen_at, ip_address_optional, user_agent_optional
        ) VALUES (
          @id, @userId, @tokenHash, @csrfTokenHash, @createdAt, @expiresAt, @lastSeenAt, @ipAddress, @userAgent
        )`
      ).run(input)
    },
    getSessionByTokenHash(tokenHash) {
      return (
        mapSessions(
          db.prepare(
            `SELECT id, user_id, token_hash, csrf_token_hash, created_at, expires_at, last_seen_at, ip_address_optional, user_agent_optional
             FROM sessions
             WHERE token_hash = ?`
          ).all(tokenHash)
        )[0] ?? null
      )
    },
    deleteSession(id) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    },
    deleteExpiredSessions(nowIso) {
      const result = db
        .prepare('DELETE FROM sessions WHERE expires_at <= ?')
        .run(nowIso)
      return result.changes
    },
    deleteSessionsByUserId(userId) {
      const result = db
        .prepare('DELETE FROM sessions WHERE user_id = ?')
        .run(userId)
      return result.changes
    },
    touchSession(id, lastSeenAt) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(lastSeenAt, id)
    },
    createJob(input) {
      db.prepare(
        `INSERT INTO jobs (
          id, user_id, status, name, profile_json, total_files, completed_files, warning_files, failed_files, cancelled_files, progress_percent, created_at, version
        ) VALUES (
          @id, @userId, @status, @name, @profileJson, @totalFiles, @completedFiles, @warningFiles, @failedFiles, @cancelledFiles, @progressPercent, @createdAt, @version
        )`
      ).run(input)
    },
    listJobsByUser(userId) {
      return mapJobs(
        db.prepare(
          `SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC`
        ).all(userId)
      )
    },
    listAllJobs() {
      return mapJobs(
        db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all()
      )
    },
    getJobById(id) {
      return mapJobs(db.prepare('SELECT * FROM jobs WHERE id = ?').all(id))[0] ?? null
    },
    updateJob(id, input) {
      const current = api.getJobById(id)
      if (!current) {
        return
      }
      db.prepare(
        `UPDATE jobs
         SET status = @status,
             name = @name,
             profile_json = @profileJson,
             total_files = @totalFiles,
             completed_files = @completedFiles,
             warning_files = @warningFiles,
             failed_files = @failedFiles,
             cancelled_files = @cancelledFiles,
             progress_percent = @progressPercent,
             queued_at = @queuedAt,
             started_at = @startedAt,
             completed_at = @completedAt,
             cancel_requested_at = @cancelRequestedAt,
             error_summary = @errorSummary
         WHERE id = @id`
      ).run({
        id,
        status: input.status ?? current.status,
        name: input.name ?? current.name,
        profileJson: input.profileJson ?? current.profileJson,
        totalFiles: input.totalFiles ?? current.totalFiles,
        completedFiles: input.completedFiles ?? current.completedFiles,
        warningFiles: input.warningFiles ?? current.warningFiles,
        failedFiles: input.failedFiles ?? current.failedFiles,
        cancelledFiles: input.cancelledFiles ?? current.cancelledFiles,
        progressPercent: input.progressPercent ?? current.progressPercent,
        queuedAt: input.queuedAt ?? current.queuedAt ?? null,
        startedAt: input.startedAt ?? current.startedAt ?? null,
        completedAt: input.completedAt ?? current.completedAt ?? null,
        cancelRequestedAt: input.cancelRequestedAt ?? current.cancelRequestedAt ?? null,
        errorSummary: input.errorSummary ?? current.errorSummary ?? null
      })
    },
    deleteJob(id) {
      db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    },
    createProfile(input) {
      db.prepare(
        `INSERT INTO profiles (
          id, user_id_optional, name, description, profile_json, is_system, created_at, updated_at
        ) VALUES (
          @id, @userId, @name, @description, @profileJson, @isSystem, @createdAt, @updatedAt
        )`
      ).run({
        ...input,
        userId: input.userId ?? null,
        isSystem: input.isSystem ? 1 : 0
      })
    },
    listProfiles(userId) {
      return mapProfiles(
        db.prepare(
          `SELECT * FROM profiles
           WHERE is_system = 1 OR user_id_optional = ?
           ORDER BY is_system DESC, name ASC`
        ).all(userId)
      )
    },
    listAllProfiles() {
      return mapProfiles(
        db.prepare(
          'SELECT * FROM profiles ORDER BY is_system DESC, name ASC'
        ).all()
      )
    },
    getProfileById(id) {
      return (
        mapProfiles(db.prepare('SELECT * FROM profiles WHERE id = ?').all(id))[0] ??
        null
      )
    },
    updateProfile(id, input) {
      const current = api.getProfileById(id)
      if (!current) {
        return
      }
      db.prepare(
        `UPDATE profiles
         SET name = @name,
             description = @description,
             profile_json = @profileJson,
             updated_at = @updatedAt
         WHERE id = @id`
      ).run({
        id,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        profileJson: input.profileJson ?? current.profileJson,
        updatedAt: input.updatedAt
      })
    },
    deleteProfile(id) {
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
    },
    createJobFile(input) {
      db.prepare(
        `INSERT INTO job_files (
          id, job_id, original_name, relative_path, stored_path, size_bytes, checksum, format, status, progress_percent, attempt_count, max_attempts, created_at, updated_at
        ) VALUES (
          @id, @jobId, @originalName, @relativePath, @storedPath, @sizeBytes, @checksum, @format, @status, @progressPercent, @attemptCount, @maxAttempts, @createdAt, @updatedAt
        )`
      ).run(input)
    },
    listJobFiles(jobId) {
      return mapJobFiles(
        db.prepare(
          'SELECT * FROM job_files WHERE job_id = ? ORDER BY created_at ASC'
        ).all(jobId)
      )
    },
    getJobFileById(id) {
      return (
        mapJobFiles(db.prepare('SELECT * FROM job_files WHERE id = ?').all(id))[0] ??
        null
      )
    },
    claimNextJobFile(workerId, nowIso): StoredJobFile | null {
      db.exec('BEGIN IMMEDIATE')
      try {
        const row = db.prepare(
          `SELECT jf.*
           FROM job_files jf
           INNER JOIN jobs j ON j.id = jf.job_id
           WHERE j.status IN ('queued', 'running')
             AND jf.status IN ('ready', 'pending')
             AND (jf.next_attempt_at IS NULL OR jf.next_attempt_at <= ?)
           ORDER BY COALESCE(j.queued_at, j.created_at) ASC, jf.created_at ASC
           LIMIT 1`
        ).get(nowIso) as Record<string, unknown> | undefined
        if (!row) {
          db.exec('COMMIT')
          return null
        }
        db.prepare(
          `UPDATE job_files
           SET status = 'claimed',
               worker_id = ?,
               claimed_at = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(workerId, nowIso, nowIso, String(row.id))
        db.exec('COMMIT')
        return api.getJobFileById(String(row.id))
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    updateJobFile(id, input) {
      const current = api.getJobFileById(id)
      if (!current) {
        return
      }
      db.prepare(
        `UPDATE job_files
         SET status = @status,
             progress_percent = @progressPercent,
             attempt_count = @attemptCount,
             max_attempts = @maxAttempts,
             next_attempt_at = @nextAttemptAt,
             worker_id = @workerId,
             claimed_at = @claimedAt,
             started_at = @startedAt,
             completed_at = @completedAt,
             error_code = @errorCode,
             error_message = @errorMessage,
             diagnostics_json = @diagnosticsJson,
             result_summary_json = @resultSummaryJson,
             updated_at = @updatedAt
         WHERE id = @id`
      ).run({
        id,
        status: input.status ?? current.status,
        progressPercent: input.progressPercent ?? current.progressPercent,
        attemptCount: input.attemptCount ?? current.attemptCount,
        maxAttempts: input.maxAttempts ?? current.maxAttempts,
        nextAttemptAt: input.nextAttemptAt ?? current.nextAttemptAt ?? null,
        workerId: input.workerId ?? current.workerId ?? null,
        claimedAt: input.claimedAt ?? current.claimedAt ?? null,
        startedAt: input.startedAt ?? current.startedAt ?? null,
        completedAt: input.completedAt ?? current.completedAt ?? null,
        errorCode: input.errorCode ?? current.errorCode ?? null,
        errorMessage: input.errorMessage ?? current.errorMessage ?? null,
        diagnosticsJson: input.diagnosticsJson ?? current.diagnosticsJson ?? null,
        resultSummaryJson: input.resultSummaryJson ?? current.resultSummaryJson ?? null,
        updatedAt: input.updatedAt
      })
    },
    cancelPendingJobFiles(jobId, nowIso) {
      const result = db.prepare(
        `UPDATE job_files
         SET status = 'cancelled',
             progress_percent = CASE WHEN progress_percent < 100 THEN progress_percent ELSE 100 END,
             completed_at = COALESCE(completed_at, ?),
             updated_at = ?
         WHERE job_id = ?
           AND status IN ('pending', 'ready')`
      ).run(nowIso, nowIso, jobId)
      return result.changes
    },
    resetFailedJobFiles(jobId, nowIso) {
      const result = db.prepare(
        `UPDATE job_files
         SET status = 'ready',
             progress_percent = 0,
             worker_id = NULL,
             claimed_at = NULL,
             started_at = NULL,
             completed_at = NULL,
             error_code = NULL,
             error_message = NULL,
             diagnostics_json = NULL,
             result_summary_json = NULL,
             next_attempt_at = NULL,
             updated_at = ?
         WHERE job_id = ?
           AND status IN ('failed', 'cancelled')`
      ).run(nowIso, jobId)
      return result.changes
    },
    recoverStaleClaimedJobFiles(staleBeforeIso, nowIso) {
      const rows = db.prepare(
        `SELECT id
         FROM job_files
         WHERE status IN ('claimed', 'parsing', 'rendering', 'exporting')
           AND claimed_at IS NOT NULL
           AND claimed_at <= ?`
      ).all(staleBeforeIso) as Array<{ id: string }>
      if (rows.length === 0) {
        return { recoveredFileIds: [] }
      }
      const ids = rows.map(row => row.id)
      const placeholders = ids.map(() => '?').join(', ')
      db.prepare(
        `UPDATE job_files
         SET status = CASE WHEN attempt_count < max_attempts THEN 'ready' ELSE 'failed' END,
             worker_id = NULL,
             claimed_at = NULL,
             started_at = NULL,
             next_attempt_at = NULL,
             error_code = CASE WHEN attempt_count < max_attempts THEN NULL ELSE 'worker_stale' END,
             error_message = CASE WHEN attempt_count < max_attempts THEN NULL ELSE 'Worker process became stale.' END,
             updated_at = ?
         WHERE id IN (${placeholders})`
      ).run(nowIso, ...ids)
      return { recoveredFileIds: ids }
    },
    deleteJobFile(id) {
      db.prepare('DELETE FROM job_files WHERE id = ?').run(id)
    },
    createArtifact(input) {
      db.prepare(
        `INSERT INTO artifacts (
          id, job_id, job_file_id_optional, type, format, relative_path, stored_path, size_bytes, checksum, mime_type, fidelity, created_at
        ) VALUES (
          @id, @jobId, @jobFileId, @type, @format, @relativePath, @storedPath, @sizeBytes, @checksum, @mimeType, @fidelity, @createdAt
        )`
      ).run({
        ...input,
        jobFileId: input.jobFileId ?? null
      })
    },
    listArtifactsByJob(jobId) {
      return mapArtifacts(
        db.prepare(
          'SELECT * FROM artifacts WHERE job_id = ? ORDER BY created_at ASC'
        ).all(jobId)
      )
    },
    getArtifactById(id) {
      return (
        mapArtifacts(db.prepare('SELECT * FROM artifacts WHERE id = ?').all(id))[0] ??
        null
      )
    },
    deleteArtifact(id) {
      db.prepare('DELETE FROM artifacts WHERE id = ?').run(id)
    }
  }

  return api
}

function runMigrations(db: BetterSqliteDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)
  for (const migration of MIGRATIONS) {
    const applied = db
      .prepare('SELECT 1 FROM schema_migrations WHERE id = ?')
      .get(migration.id)
    if (applied) {
      continue
    }
    const transaction = db.transaction(() => {
      for (const sql of migration.sql) {
        db.exec(sql)
      }
      db.prepare(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
      ).run(migration.id, new Date().toISOString())
    })
    transaction()
  }
}

function mapUsers(rows: unknown[]): StoredUser[] {
  return rows.map(row => {
    const user = row as Record<string, unknown>
    return {
      id: String(user.id),
      username: String(user.username),
      normalizedUsername: String(user.normalized_username),
      passwordHash: String(user.password_hash),
      role: user.role as Role,
      isActive: Number(user.is_active) === 1,
      createdAt: String(user.created_at),
      updatedAt: String(user.updated_at),
      lastLoginAt:
        typeof user.last_login_at === 'string' ? user.last_login_at : undefined
    }
  })
}

function mapSessions(rows: unknown[]): StoredSession[] {
  return rows.map(row => {
    const session = row as Record<string, unknown>
    return {
      id: String(session.id),
      userId: String(session.user_id),
      tokenHash: String(session.token_hash),
      csrfTokenHash: String(session.csrf_token_hash),
      createdAt: String(session.created_at),
      expiresAt: String(session.expires_at),
      lastSeenAt: String(session.last_seen_at),
      ipAddress:
        typeof session.ip_address_optional === 'string'
          ? session.ip_address_optional
          : undefined,
      userAgent:
        typeof session.user_agent_optional === 'string'
          ? session.user_agent_optional
          : undefined
    }
  })
}

function mapJobs(rows: unknown[]): StoredJob[] {
  return rows.map(row => {
    const job = row as Record<string, unknown>
    return {
      id: String(job.id),
      userId: String(job.user_id),
      status: String(job.status),
      name: String(job.name),
      profileJson: String(job.profile_json),
      totalFiles: Number(job.total_files),
      completedFiles: Number(job.completed_files),
      warningFiles: Number(job.warning_files),
      failedFiles: Number(job.failed_files),
      cancelledFiles: Number(job.cancelled_files),
      progressPercent: Number(job.progress_percent),
      createdAt: String(job.created_at),
      queuedAt: typeof job.queued_at === 'string' ? job.queued_at : undefined,
      startedAt: typeof job.started_at === 'string' ? job.started_at : undefined,
      completedAt:
        typeof job.completed_at === 'string' ? job.completed_at : undefined,
      cancelRequestedAt:
        typeof job.cancel_requested_at === 'string'
          ? job.cancel_requested_at
          : undefined,
      errorSummary:
        typeof job.error_summary === 'string' ? job.error_summary : undefined,
      version: String(job.version)
    }
  })
}

function mapProfiles(rows: unknown[]): StoredProfile[] {
  return rows.map(row => {
    const profile = row as Record<string, unknown>
    return {
      id: String(profile.id),
      userId:
        typeof profile.user_id_optional === 'string'
          ? profile.user_id_optional
          : undefined,
      name: String(profile.name),
      description: String(profile.description),
      profileJson: String(profile.profile_json),
      isSystem: Number(profile.is_system) === 1,
      createdAt: String(profile.created_at),
      updatedAt: String(profile.updated_at)
    }
  })
}

function mapJobFiles(rows: unknown[]): StoredJobFile[] {
  return rows.map(row => {
    const file = row as Record<string, unknown>
    return {
      id: String(file.id),
      jobId: String(file.job_id),
      originalName: String(file.original_name),
      relativePath: String(file.relative_path),
      storedPath: String(file.stored_path),
      sizeBytes: Number(file.size_bytes),
      checksum: String(file.checksum),
      format: String(file.format),
      detectedVersion:
        typeof file.detected_version === 'string' ? file.detected_version : undefined,
      status: String(file.status),
      progressPercent: Number(file.progress_percent),
      attemptCount: Number(file.attempt_count),
      maxAttempts: Number(file.max_attempts),
      nextAttemptAt:
        typeof file.next_attempt_at === 'string' ? file.next_attempt_at : undefined,
      workerId: typeof file.worker_id === 'string' ? file.worker_id : undefined,
      claimedAt: typeof file.claimed_at === 'string' ? file.claimed_at : undefined,
      startedAt: typeof file.started_at === 'string' ? file.started_at : undefined,
      completedAt:
        typeof file.completed_at === 'string' ? file.completed_at : undefined,
      errorCode: typeof file.error_code === 'string' ? file.error_code : undefined,
      errorMessage:
        typeof file.error_message === 'string' ? file.error_message : undefined,
      diagnosticsJson:
        typeof file.diagnostics_json === 'string' ? file.diagnostics_json : undefined,
      resultSummaryJson:
        typeof file.result_summary_json === 'string'
          ? file.result_summary_json
          : undefined,
      createdAt: String(file.created_at),
      updatedAt: String(file.updated_at)
    }
  })
}

function mapArtifacts(rows: unknown[]): StoredArtifact[] {
  return rows.map(row => {
    const artifact = row as Record<string, unknown>
    return {
      id: String(artifact.id),
      jobId: String(artifact.job_id),
      jobFileId:
        typeof artifact.job_file_id_optional === 'string'
          ? artifact.job_file_id_optional
          : undefined,
      type: String(artifact.type),
      format: String(artifact.format),
      relativePath: String(artifact.relative_path),
      storedPath: String(artifact.stored_path),
      sizeBytes: Number(artifact.size_bytes),
      checksum: String(artifact.checksum),
      mimeType: String(artifact.mime_type),
      fidelity: String(artifact.fidelity),
      createdAt: String(artifact.created_at)
    }
  })
}
