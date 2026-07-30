// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxInputSource } from '@cadflux/core'

const SUPPORTED_EXTENSIONS = new Set(['.dwg', '.dxf'])

export function browserFilesToInputs(files: Iterable<File>): CadFluxInputSource[] {
  return Array.from(files)
    .filter(file => SUPPORTED_EXTENSIONS.has(extensionOf(file.name)))
    .map(file => ({
      name: file.name,
      relativePath:
        ((file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name),
      extension: extensionOf(file.name),
      sizeBytes: file.size,
      lastModifiedMs: file.lastModified,
      browserFile: file
    }))
}

export function supportsCadExtension(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(fileName))
}

export function extensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}
