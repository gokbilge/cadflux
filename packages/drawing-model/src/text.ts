// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type {
  DrawingColor,
  DrawingDiagnostic
} from './index'

export type TextHorizontalAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'aligned'
  | 'middle'
  | 'fit'

export type TextVerticalAlignment =
  | 'baseline'
  | 'bottom'
  | 'middle'
  | 'top'

export interface DrawingTextStyle {
  fontFamily?: string
  fontFileName?: string
  fontStyle?: 'normal' | 'italic'
  fontWeight?: number
  height: number
  widthFactor?: number
  obliqueAngle?: number
  rotation?: number
  color?: DrawingColor
  horizontalAlignment?: TextHorizontalAlignment
  verticalAlignment?: TextVerticalAlignment
  underline?: boolean
  overline?: boolean
}

export interface DrawingTextRun {
  text: string
  style: Partial<DrawingTextStyle>
}

export interface ParseMTextOptions {
  defaultStyle: DrawingTextStyle
  preserveUnknownCodes?: boolean
}

export interface ParsedMText {
  rawText: string
  plainText: string
  runs: DrawingTextRun[]
  diagnostics: DrawingDiagnostic[]
}

interface MutableStyle extends Partial<DrawingTextStyle> {}

export function parseMText(
  source: string,
  options: ParseMTextOptions
): ParsedMText {
  const diagnostics: DrawingDiagnostic[] = []
  const runs: DrawingTextRun[] = []
  let plainText = ''
  let buffer = ''
  let index = 0
  let style: MutableStyle = {}

  const flush = () => {
    if (!buffer) return
    runs.push({
      text: buffer,
      style: { ...style }
    })
    plainText += buffer
    buffer = ''
  }

  while (index < source.length) {
    const current = source[index]!

    if (current === '{' || current === '}') {
      index += 1
      continue
    }

    if (current !== '\\') {
      buffer += current
      index += 1
      continue
    }

    const next = source[index + 1]
    if (next == null) {
      buffer += '\\'
      break
    }

    if (next === '\\' || next === '{' || next === '}') {
      buffer += next
      index += 2
      continue
    }

    if (next === '~') {
      buffer += '\u00A0'
      index += 2
      continue
    }

    if (next === 'P') {
      buffer += '\n'
      index += 2
      continue
    }

    if (next === 'L') {
      flush()
      style = { ...style, underline: true }
      index += 2
      continue
    }

    if (next === 'l') {
      flush()
      const { underline: _removed, ...rest } = style
      style = rest
      index += 2
      continue
    }

    if (next === 'O') {
      flush()
      style = { ...style, overline: true }
      index += 2
      continue
    }

    if (next === 'o') {
      flush()
      const { overline: _removed, ...rest } = style
      style = rest
      index += 2
      continue
    }

    if (next === 'C' || next === 'H' || next === 'W' || next === 'F' || next === 'S') {
      const control = next
      const payloadStart = index + 2
      const payloadEnd = source.indexOf(';', payloadStart)
      if (payloadEnd === -1) {
        buffer += source.slice(index)
        break
      }
      const payload = source.slice(payloadStart, payloadEnd)
      flush()
      applyControlCode(control, payload, options.defaultStyle, style, diagnostics)
      if (control === 'S') {
        const simplified = simplifyStackedFraction(payload)
        runs.push({
          text: simplified,
          style: { ...style }
        })
        plainText += simplified
      }
      index = payloadEnd + 1
      continue
    }

    const fallback = `\\${next}`
    if (options.preserveUnknownCodes) {
      buffer += fallback
    }
    diagnostics.push({
      severity: 'warning',
      code: 'MTEXT_UNSUPPORTED_CONTROL_SEQUENCE',
      message: `Unsupported MTEXT control sequence ${fallback}.`,
      details: { sequence: fallback }
    })
    index += 2
  }

  flush()

  return {
    rawText: source,
    plainText,
    runs,
    diagnostics
  }
}

function applyControlCode(
  control: 'C' | 'H' | 'W' | 'F' | 'S',
  payload: string,
  defaultStyle: DrawingTextStyle,
  style: MutableStyle,
  diagnostics: DrawingDiagnostic[]
) {
  switch (control) {
    case 'C': {
      const aci = Number(payload)
      if (!Number.isFinite(aci)) {
        diagnostics.push(unsupportedControl(control, payload))
        return
      }
      style.color = aciToColor(aci)
      return
    }
    case 'H': {
      const relative = payload.endsWith('x')
      const number = Number(relative ? payload.slice(0, -1) : payload)
      if (!Number.isFinite(number)) {
        diagnostics.push(unsupportedControl(control, payload))
        return
      }
      style.height = relative ? defaultStyle.height * number : number
      return
    }
    case 'W': {
      const relative = payload.endsWith('x')
      const number = Number(relative ? payload.slice(0, -1) : payload)
      if (!Number.isFinite(number)) {
        diagnostics.push(unsupportedControl(control, payload))
        return
      }
      style.widthFactor = relative
        ? (defaultStyle.widthFactor ?? 1) * number
        : number
      return
    }
    case 'F': {
      const [familyPart] = payload.split('|')
      if (!familyPart) {
        diagnostics.push(unsupportedControl(control, payload))
        return
      }
      style.fontFamily = familyPart
      return
    }
    case 'S':
      return
  }
}

function simplifyStackedFraction(payload: string): string {
  return payload.replaceAll('#', '/').replaceAll('^', '/')
}

function unsupportedControl(control: string, payload: string): DrawingDiagnostic {
  return {
    severity: 'warning',
    code: 'MTEXT_UNSUPPORTED_CONTROL_SEQUENCE',
    message: `Unsupported MTEXT control sequence \\${control}${payload};.`,
    details: {
      control,
      payload
    }
  }
}

function aciToColor(aci: number): DrawingColor {
  const table: Record<number, [number, number, number]> = {
    1: [255, 0, 0],
    2: [255, 255, 0],
    3: [0, 255, 0],
    4: [0, 255, 255],
    5: [0, 0, 255],
    6: [255, 0, 255],
    7: [255, 255, 255]
  }
  const rgb = table[Math.abs(Math.trunc(aci))] ?? [255, 255, 255]
  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    source: 'aci',
    aci: Math.abs(Math.trunc(aci))
  }
}
