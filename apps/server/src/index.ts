#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { randomUUID } from 'node:crypto'
import process from 'node:process'

import {
  hashPassword,
  normalizeUsername,
  validatePasswordStrength
} from '@cadflux/auth'
import { openCadFluxDatabase } from '@cadflux/database'

import { loadServerConfig } from './config.js'
import { createJobEventBus } from './events.js'
import { buildServer, bootstrapAdminUser } from './server.js'
import { startServerWorker } from './worker.js'

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'serve'
  const config = loadServerConfig()
  const database = openCadFluxDatabase({ databasePath: config.databasePath })
  database.runMigrations()

  if (command === 'doctor') {
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          databasePath: config.databasePath,
          dataDir: config.dataDir,
          userCount: database.countUsers()
        },
        null,
        2
      )
    )
    database.close()
    return
  }

  if (command === 'user:create') {
    const username = readArgument('--username')
    const password = readArgument('--password')
    const role = (readArgument('--role') ?? 'user') as 'admin' | 'user'
    if (!username || !password) {
      throw new Error('user:create requires --username and --password.')
    }
    const passwordError = validatePasswordStrength(password)
    if (passwordError) {
      throw new Error(passwordError)
    }
    const now = new Date().toISOString()
    database.createUser({
      id: randomUUID(),
      username: username.trim(),
      normalizedUsername: normalizeUsername(username),
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    console.log(`Created user ${username.trim()}.`)
    database.close()
    return
  }

  if (command === 'user:reset-password') {
    const username = readArgument('--username')
    const newPassword = readArgument('--password')
    if (!username || !newPassword) {
      throw new Error('user:reset-password requires --username and --password.')
    }
    const user = database.getUserByNormalizedUsername(normalizeUsername(username))
    if (!user) {
      throw new Error('User not found.')
    }
    const passwordError = validatePasswordStrength(newPassword)
    if (passwordError) {
      throw new Error(passwordError)
    }
    database.updateUser(user.id, {
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString()
    })
    database.deleteSessionsByUserId(user.id)
    console.log(`Reset password for ${user.username}.`)
    database.close()
    return
  }

  await bootstrapAdminUser(database, config)
  const events = createJobEventBus()
  const worker = startServerWorker({
    config,
    database,
    events,
    logger: {
      info(payload, message) {
        console.log(message ?? 'cadflux.worker', payload)
      },
      error(payload, message) {
        console.error(message ?? 'cadflux.worker', payload)
      }
    }
  })
  const server = await buildServer({
    config,
    database,
    events,
    worker
  })
  server.addHook('onClose', async () => {
    await worker.close()
  })
  await server.listen({ host: config.host, port: config.port })
}

function readArgument(flag: string): string | undefined {
  const index = process.argv.findIndex(value => value === flag)
  if (index < 0) {
    return undefined
  }
  return process.argv[index + 1]
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
