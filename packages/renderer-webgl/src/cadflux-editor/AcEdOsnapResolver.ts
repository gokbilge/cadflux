// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { AcGePoint2dLike, AcGePoint3dLike } from '@mlightcad/data-model'

import type { AcEdMarkerType } from '../../../cad-simple-viewer/src/editor/input/marker/AcEdMarker'
import type { AcEdBaseView } from '../../../cad-simple-viewer/src/editor/view/AcEdBaseView'

export type AcEdOsnapPoint = AcGePoint3dLike & {
  type: number
}

export interface AcEdOsnapResolveOptions {
  cursorWcs: AcGePoint2dLike
  lastPoint?: AcGePoint3dLike
  hitRadiusPx?: number
}

export class AcEdOsnapResolver {
  constructor(_view: AcEdBaseView) {}

  resolve(_options: AcEdOsnapResolveOptions): AcEdOsnapPoint | undefined {
    return undefined
  }

  static osnapModeToMarkerType(_osnapMode: number): AcEdMarkerType {
    return 'rect'
  }
}
