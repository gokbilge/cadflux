// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { Type, type Static } from '@sinclair/typebox'

export const API_PREFIX = '/api/v1'

export const RoleSchema = Type.Union([Type.Literal('admin'), Type.Literal('user')])
export type Role = Static<typeof RoleSchema>

export const UserSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  role: RoleSchema,
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  lastLoginAt: Type.Optional(Type.String({ format: 'date-time' }))
})
export type UserDto = Static<typeof UserSchema>

export const SessionSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
  lastSeenAt: Type.String({ format: 'date-time' })
})
export type SessionDto = Static<typeof SessionSchema>

export const AuthResponseSchema = Type.Object({
  user: UserSchema,
  csrfToken: Type.String(),
  sessionExpiresAt: Type.String({ format: 'date-time' })
})
export type AuthResponse = Static<typeof AuthResponseSchema>

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String()
  })
})
export type ErrorResponse = Static<typeof ErrorResponseSchema>

export const LoginRequestSchema = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 128 }),
  password: Type.String({ minLength: 1, maxLength: 1024 })
})
export type LoginRequest = Static<typeof LoginRequestSchema>

export const ChangePasswordRequestSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1, maxLength: 1024 }),
  newPassword: Type.String({ minLength: 12, maxLength: 1024 })
})
export type ChangePasswordRequest = Static<typeof ChangePasswordRequestSchema>

export const CreateUserRequestSchema = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 128 }),
  password: Type.String({ minLength: 12, maxLength: 1024 }),
  role: RoleSchema,
  isActive: Type.Optional(Type.Boolean())
})
export type CreateUserRequest = Static<typeof CreateUserRequestSchema>

export const UpdateUserRequestSchema = Type.Object({
  role: Type.Optional(RoleSchema),
  isActive: Type.Optional(Type.Boolean())
})
export type UpdateUserRequest = Static<typeof UpdateUserRequestSchema>

export const ResetPasswordRequestSchema = Type.Object({
  newPassword: Type.String({ minLength: 12, maxLength: 1024 })
})
export type ResetPasswordRequest = Static<typeof ResetPasswordRequestSchema>

export const UserListResponseSchema = Type.Object({
  users: Type.Array(UserSchema)
})
export type UserListResponse = Static<typeof UserListResponseSchema>

export const JobStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('uploading'),
  Type.Literal('queued'),
  Type.Literal('running'),
  Type.Literal('pausing'),
  Type.Literal('paused'),
  Type.Literal('cancelling'),
  Type.Literal('cancelled'),
  Type.Literal('completed'),
  Type.Literal('completed_with_warnings'),
  Type.Literal('failed')
])
export type JobStatus = Static<typeof JobStatusSchema>

export const JobSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  name: Type.String(),
  status: JobStatusSchema,
  profileJson: Type.String(),
  totalFiles: Type.Number(),
  completedFiles: Type.Number(),
  warningFiles: Type.Number(),
  failedFiles: Type.Number(),
  cancelledFiles: Type.Number(),
  progressPercent: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  queuedAt: Type.Optional(Type.String({ format: 'date-time' })),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  cancelRequestedAt: Type.Optional(Type.String({ format: 'date-time' })),
  errorSummary: Type.Optional(Type.String()),
  version: Type.String()
})
export type JobDto = Static<typeof JobSchema>

export const CreateJobRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 256 }),
  profileJson: Type.String({ minLength: 2 })
})
export type CreateJobRequest = Static<typeof CreateJobRequestSchema>

export const UpdateJobRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
  profileJson: Type.Optional(Type.String({ minLength: 2 }))
})
export type UpdateJobRequest = Static<typeof UpdateJobRequestSchema>

export const JobListResponseSchema = Type.Object({
  jobs: Type.Array(JobSchema)
})
export type JobListResponse = Static<typeof JobListResponseSchema>

export const JobResponseSchema = Type.Object({
  job: JobSchema
})
export type JobResponse = Static<typeof JobResponseSchema>

export const ProfileSchema = Type.Object({
  id: Type.String(),
  userId: Type.Optional(Type.String()),
  name: Type.String(),
  description: Type.String(),
  profileJson: Type.String(),
  isSystem: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' })
})
export type ProfileDto = Static<typeof ProfileSchema>

export const CreateProfileRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 256 }),
  description: Type.String({ maxLength: 1024 }),
  profileJson: Type.String({ minLength: 2 })
})
export type CreateProfileRequest = Static<typeof CreateProfileRequestSchema>

export const UpdateProfileRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
  description: Type.Optional(Type.String({ maxLength: 1024 })),
  profileJson: Type.Optional(Type.String({ minLength: 2 }))
})
export type UpdateProfileRequest = Static<typeof UpdateProfileRequestSchema>

export const ProfileListResponseSchema = Type.Object({
  profiles: Type.Array(ProfileSchema)
})
export type ProfileListResponse = Static<typeof ProfileListResponseSchema>

export const ProfileResponseSchema = Type.Object({
  profile: ProfileSchema
})
export type ProfileResponse = Static<typeof ProfileResponseSchema>

export const JobFileStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('ready'),
  Type.Literal('claimed'),
  Type.Literal('parsing'),
  Type.Literal('rendering'),
  Type.Literal('exporting'),
  Type.Literal('completed'),
  Type.Literal('completed_with_warnings'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('skipped')
])
export type JobFileStatus = Static<typeof JobFileStatusSchema>

export const JobFileSchema = Type.Object({
  id: Type.String(),
  jobId: Type.String(),
  originalName: Type.String(),
  relativePath: Type.String(),
  sizeBytes: Type.Number(),
  checksum: Type.String(),
  format: Type.String(),
  status: JobFileStatusSchema,
  progressPercent: Type.Number(),
  attemptCount: Type.Number(),
  maxAttempts: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  errorCode: Type.Optional(Type.String()),
  errorMessage: Type.Optional(Type.String())
})
export type JobFileDto = Static<typeof JobFileSchema>

export const JobFileListResponseSchema = Type.Object({
  files: Type.Array(JobFileSchema)
})
export type JobFileListResponse = Static<typeof JobFileListResponseSchema>

export const JobFileResponseSchema = Type.Object({
  file: JobFileSchema
})
export type JobFileResponse = Static<typeof JobFileResponseSchema>

export const HealthResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
  timestamp: Type.String({ format: 'date-time' }),
  version: Type.String(),
  checks: Type.Record(Type.String(), Type.String())
})
export type HealthResponse = Static<typeof HealthResponseSchema>
