// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export class AcApHtmlConvertor {}

export function packHtml() {
  throw new Error('CadFlux web does not include the optional HTML export plugin.')
}

export class AcApHtmlSnapshotBuilder {}

export function captureAcApHtmlViewState() {
  return undefined
}

export function resolveAcApHtmlExportOptions() {
  return {}
}
