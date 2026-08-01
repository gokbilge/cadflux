// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { AcEdBaseView } from '../mlightcad-bridge/editor'

export class AcEdGripManager {
  constructor(_view: AcEdBaseView) {}

  get isDragging(): boolean {
    return false
  }

  dispose() {}

  refresh() {}
}
