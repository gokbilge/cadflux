// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxProfile } from '@cadflux/core'

export const CADFLUX_PRESETS: CadFluxProfile[] = [
  {
    id: 'a4-fit-pdf',
    label: 'A4 Fit PDF',
    paper: 'A4',
    orientation: 'auto',
    scale: 'fit',
    color: 'color',
    formats: ['pdf']
  },
  {
    id: 'a3-monochrome-pdf',
    label: 'A3 Monochrome PDF',
    paper: 'A3',
    orientation: 'auto',
    scale: 'fit',
    color: 'monochrome',
    formats: ['pdf']
  },
  {
    id: 'a3-svg-and-pdf',
    label: 'A3 SVG and PDF',
    paper: 'A3',
    orientation: 'auto',
    scale: 'fit',
    color: 'color',
    formats: ['svg', 'pdf']
  }
]

export function getCadFluxPreset(id: string): CadFluxProfile | undefined {
  return CADFLUX_PRESETS.find(preset => preset.id === id)
}

export function validateCadFluxProfile(profile: unknown): profile is CadFluxProfile {
  if (typeof profile !== 'object' || profile == null) {
    return false
  }
  const candidate = profile as Partial<CadFluxProfile>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    ['A0', 'A1', 'A2', 'A3', 'A4'].includes(candidate.paper ?? '') &&
    ['portrait', 'landscape', 'auto'].includes(candidate.orientation ?? '') &&
    typeof candidate.scale === 'string' &&
    ['color', 'monochrome'].includes(candidate.color ?? '') &&
    Array.isArray(candidate.formats)
  )
}
