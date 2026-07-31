// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import bcrypt from 'bcryptjs'

export interface SessionTokens {
  sessionToken: string
  csrfToken: string
}

export function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase('en-US')
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters long.'
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password)) {
    return 'Password must include both lowercase and uppercase letters.'
  }
  if (!/\d/u.test(password)) {
    return 'Password must include at least one number.'
  }
  return null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export function createSessionTokens(): SessionTokens {
  return {
    sessionToken: randomBytes(32).toString('base64url'),
    csrfToken: randomBytes(24).toString('base64url')
  }
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function constantTimeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}
