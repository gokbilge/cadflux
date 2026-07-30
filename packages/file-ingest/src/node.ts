// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { CadFluxInputSource } from '@cadflux/core'

import { extensionOf, supportsCadExtension } from './index'

export interface NodeInputOptions {
  recursive: boolean
}

export async function collectNodeInputs(
  rawInputs: string[],
  options: NodeInputOptions
): Promise<CadFluxInputSource[]> {
  const collected: CadFluxInputSource[] = []
  for (const rawInput of rawInputs) {
    const absolute = path.resolve(rawInput)
    const info = await stat(absolute)
    if (info.isDirectory()) {
      const files = await collectDirectory(absolute, absolute, options.recursive)
      collected.push(...files)
      continue
    }
    if (!supportsCadExtension(absolute)) {
      continue
    }
    collected.push({
      name: path.basename(absolute),
      absolutePath: absolute,
      relativePath: path.basename(absolute),
      extension: extensionOf(absolute),
      sizeBytes: info.size,
      lastModifiedMs: info.mtimeMs
    })
  }
  return collected
}

async function collectDirectory(
  rootDirectory: string,
  currentDirectory: string,
  recursive: boolean
): Promise<CadFluxInputSource[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true })
  const collected: CadFluxInputSource[] = []

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        collected.push(
          ...(await collectDirectory(rootDirectory, absolutePath, recursive))
        )
      }
      continue
    }
    if (!supportsCadExtension(entry.name)) {
      continue
    }
    const info = await stat(absolutePath)
    collected.push({
      name: entry.name,
      absolutePath,
      relativePath: path.relative(rootDirectory, absolutePath),
      extension: extensionOf(entry.name),
      sizeBytes: info.size,
      lastModifiedMs: info.mtimeMs
    })
  }

  return collected
}
