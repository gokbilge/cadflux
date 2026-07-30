// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxInputSource } from '@cadflux/core'

export interface CadFluxDrawingHandle {
  id: string
  input: CadFluxInputSource
  title: string
  openedAt: string
}

export function createDrawingHandle(
  input: CadFluxInputSource
): CadFluxDrawingHandle {
  return {
    id: `${input.relativePath ?? input.name}:${input.lastModifiedMs ?? 0}`,
    input,
    title: input.name,
    openedAt: new Date().toISOString()
  }
}
