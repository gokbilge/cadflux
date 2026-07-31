// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { FontManager as FontManagerType } from '@mlightcad/mtext-renderer'

let fontManagerPromise: Promise<FontManagerType> | undefined

async function getFontManagerInstance() {
  fontManagerPromise ??= import('@mlightcad/mtext-renderer').then(
    ({ FontManager }) => FontManager.instance
  )
  return fontManagerPromise
}

export async function setCadFluxDefaultFonts(preset: string): Promise<void> {
  const fontManager = await getFontManagerInstance()
  fontManager.setDefaultFonts(preset)
}

export async function getCadFluxFontsToLoad(): Promise<string[]> {
  const fontManager = await getFontManagerInstance()
  return [...fontManager.getFontsToLoad()]
}
