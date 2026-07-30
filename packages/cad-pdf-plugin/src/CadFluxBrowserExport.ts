// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

type FontMapping = Record<string, string>

const SETTINGS_LS_KEY = 'settings'
const usedDownloadNames = new Set<string>()

interface StoredSettings {
  fontMapping?: FontMapping
}

function getDrawingExportBaseName(
  fileName: string | undefined,
  fallback = 'drawing'
): string {
  const normalized = fileName?.trim()
  if (!normalized) {
    return fallback
  }

  const leafName = normalized.split(/[\\/]/).pop() ?? normalized
  const base = leafName.replace(/\.[^.]+$/, '').trim()
  return base || fallback
}

export function resolveCadFluxExportDownloadName(
  sourceName: string | undefined,
  extension: string,
  fallbackBaseName = 'drawing'
): string {
  const baseName = getDrawingExportBaseName(sourceName, fallbackBaseName)
  const normalizedExtension = extension.startsWith('.')
    ? extension
    : `.${extension}`

  let suffix = 0
  let candidate = `${baseName}${normalizedExtension}`

  while (usedDownloadNames.has(candidate)) {
    suffix += 1
    candidate = `${baseName}-${suffix + 1}${normalizedExtension}`
  }

  usedDownloadNames.add(candidate)
  return candidate
}

export function readCadFluxBrowserFontMapping(): FontMapping {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(SETTINGS_LS_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as StoredSettings
    return parsed.fontMapping ?? {}
  } catch {
    return {}
  }
}
