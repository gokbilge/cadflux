// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { CadFluxInputSource } from '@cadflux/core'

import { extensionOf, supportsCadExtension } from './index'

export interface NodeInputOptions {
  recursive: boolean
  include?: string[]
  exclude?: string[]
}

export async function collectNodeInputs(
  rawInputs: string[],
  options: NodeInputOptions
): Promise<CadFluxInputSource[]> {
  const collected = new Map<string, CadFluxInputSource>()
  const matcher = createPathMatcher(options)

  for (const rawInput of rawInputs) {
    const absolute = path.resolve(rawInput)
    const info = await stat(absolute)
    if (info.isDirectory()) {
      const files = await collectDirectory(absolute, absolute, options.recursive, matcher)
      for (const file of files) {
        if (file.absolutePath) {
          collected.set(file.absolutePath, file)
        }
      }
      continue
    }
    if (!supportsCadExtension(absolute)) {
      continue
    }
    const relativePath = path.basename(absolute)
    if (!matcher(relativePath)) {
      continue
    }
    collected.set(absolute, {
      name: path.basename(absolute),
      absolutePath: absolute,
      relativePath,
      extension: extensionOf(absolute),
      sizeBytes: info.size,
      lastModifiedMs: info.mtimeMs
    })
  }

  return Array.from(collected.values()).sort(compareInputs)
}

export async function readInputListFile(inputListPath: string): Promise<string[]> {
  const content = await readFile(path.resolve(inputListPath), 'utf8')
  return content
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
}

async function collectDirectory(
  rootDirectory: string,
  currentDirectory: string,
  recursive: boolean,
  matcher: (relativePath: string) => boolean
): Promise<CadFluxInputSource[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true })
  const collected: CadFluxInputSource[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(currentDirectory, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        collected.push(
          ...(await collectDirectory(
            rootDirectory,
            absolutePath,
            recursive,
            matcher
          ))
        )
      }
      continue
    }
    if (!supportsCadExtension(entry.name)) {
      continue
    }
    const relativePath = normalizeRelativePath(
      path.relative(rootDirectory, absolutePath)
    )
    if (!matcher(relativePath)) {
      continue
    }
    const info = await stat(absolutePath)
    collected.push({
      name: entry.name,
      absolutePath,
      relativePath,
      extension: extensionOf(entry.name),
      sizeBytes: info.size,
      lastModifiedMs: info.mtimeMs
    })
  }

  return collected
}

function compareInputs(left: CadFluxInputSource, right: CadFluxInputSource): number {
  const leftKey = left.absolutePath ?? left.relativePath ?? left.name
  const rightKey = right.absolutePath ?? right.relativePath ?? right.name
  return leftKey.localeCompare(rightKey)
}

function createPathMatcher(options: NodeInputOptions) {
  const includes = (options.include ?? []).map(createGlobMatcher)
  const excludes = (options.exclude ?? []).map(createGlobMatcher)
  return (relativePath: string) => {
    const normalized = normalizeRelativePath(relativePath)
    const baseName = path.posix.basename(normalized)
    const included =
      includes.length === 0 ||
      includes.some(match => match(normalized) || match(baseName))
    if (!included) {
      return false
    }
    return !excludes.some(match => match(normalized) || match(baseName))
  }
}

function createGlobMatcher(pattern: string) {
  const normalizedPattern = normalizeRelativePath(pattern.trim())
  const escaped = normalizedPattern
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replaceAll('/**/', '/(?:.+/)?')
    .replaceAll('**', '.*')
    .replaceAll('*', '[^/]*')
  const regex = new RegExp(`^${escaped}$`, 'iu')
  return (value: string) => regex.test(normalizeRelativePath(value))
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/')
}
