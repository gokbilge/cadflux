// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface CadFluxFeatureFlags {
  browserBatchZip: boolean
  directDirectoryWrite: boolean
  indexedDbWorkspace: boolean
}

export const CADFLUX_DEFAULT_FLAGS: CadFluxFeatureFlags = {
  browserBatchZip: true,
  directDirectoryWrite: true,
  indexedDbWorkspace: true
}

export const CADFLUX_WEB_BASE_URL =
  'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/'
