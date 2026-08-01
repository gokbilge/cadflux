// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxInputSource } from '@cadflux/core'
import {
  DRAWING_MODEL_SCHEMA_VERSION,
  identityMatrix,
  type BlockReferenceEntity,
  type CircleEntity,
  type DrawingBlock,
  type DrawingColor,
  type DrawingDiagnostic,
  type DrawingDocument,
  type DrawingEntity,
  type DrawingLayer,
  type DrawingLayout,
  type LineEntity,
  type Point2D,
  type PolylineEntity,
  type TextEntity,
  type UnsupportedEntity
} from '@cadflux/drawing-model'
import { inspectDwgInput } from '@cadflux/dwg-adapter'
import { inspectDxfInput } from '@cadflux/dxf-adapter'

import type {
  CadInput,
  CadInspectResult,
  CadParseOptions,
  CadParseResult,
  CadParserAdapter
} from '../types'

type DxfPair = { code: string; value: string }
type DxfRecord = { type: string; pairs: DxfPair[] }

function toInputSource(input: CadInput): CadFluxInputSource {
  return {
    name: input.name,
    absolutePath: input.path,
    relativePath: input.relativePath,
    extension: `.${inferFormat(input)}`,
    sizeBytes: input.sizeBytes,
    lastModifiedMs: input.lastModifiedMs
  }
}

function inferFormat(input: CadInput): 'dwg' | 'dxf' {
  if (input.format) return input.format
  return input.name.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf'
}

function toDiagnostics(warnings: string[], sourceType: string): DrawingDiagnostic[] {
  return warnings.map(message => ({
    severity: 'warning',
    code: 'legacy_inspection_warning',
    message,
    sourceType
  }))
}

function pairValue(record: DxfRecord, code: string): string | undefined {
  return record.pairs.find(pair => pair.code === code)?.value
}

function pairNumber(record: DxfRecord, code: string, fallback = 0): number {
  const value = pairValue(record, code)
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function pairInt(record: DxfRecord, code: string, fallback = 0): number {
  return Math.trunc(pairNumber(record, code, fallback))
}

function toPairs(text: string): DxfPair[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const pairs: DxfPair[] = []
  for (let index = 0; index < lines.length - 1; index += 2) {
    const code = lines[index]?.trim()
    const value = lines[index + 1] ?? ''
    if (!code) continue
    pairs.push({ code, value })
  }
  return pairs
}

function toEntityId(type: string, handle: string | undefined, index: number): string {
  return `${type.toLowerCase()}:${handle && handle.trim() ? handle.trim() : index}`
}

function toLayerId(name: string): string {
  return `layer:${name || '0'}`
}

function toAciColor(aci: number | undefined): DrawingColor | undefined {
  if (aci == null) return undefined
  const table: Record<number, [number, number, number]> = {
    1: [255, 0, 0],
    2: [255, 255, 0],
    3: [0, 255, 0],
    4: [0, 255, 255],
    5: [0, 0, 255],
    6: [255, 0, 255],
    7: [255, 255, 255]
  }
  const rgb = table[aci]
  if (!rgb) return { r: 255, g: 255, b: 255, source: 'aci', aci }
  return { r: rgb[0], g: rgb[1], b: rgb[2], source: 'aci', aci }
}

function parseHeader(pairs: DxfPair[]): { version?: string } {
  let inHeader = false
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    if (pair.code === '0' && pair.value === 'SECTION' && pairs[index + 1]?.value === 'HEADER') {
      inHeader = true
      continue
    }
    if (inHeader && pair.code === '0' && pair.value === 'ENDSEC') break
    if (inHeader && pair.code === '9' && pair.value === '$ACADVER') {
      return { version: pairs[index + 1]?.value?.trim() }
    }
  }
  return {}
}

function parseLayers(pairs: DxfPair[]): DrawingLayer[] {
  const layers: DrawingLayer[] = []
  let inLayerTable = false
  let current: DxfPair[] = []

  const flush = () => {
    if (!current.length) return
    const record: DxfRecord = { type: 'LAYER', pairs: current }
    const name = pairValue(record, '2')?.trim() || '0'
    const flags = pairInt(record, '70', 0)
    const aci = pairInt(record, '62', 7)
    layers.push({
      id: toLayerId(name),
      name,
      visible: aci >= 0,
      locked: (flags & 4) !== 0,
      color: toAciColor(Math.abs(aci)),
      lineType: pairValue(record, '6')?.trim(),
      lineWeight: pairInt(record, '370', -1)
    })
    current = []
  }

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    if (pair.code === '0' && pair.value === 'TABLE' && pairs[index + 1]?.value === 'LAYER') {
      inLayerTable = true
      current = []
      continue
    }
    if (!inLayerTable) continue
    if (pair.code === '0' && pair.value === 'ENDTAB') {
      flush()
      break
    }
    if (pair.code === '0' && pair.value === 'LAYER') {
      flush()
      continue
    }
    current.push(pair)
  }

  if (!layers.some(layer => layer.name === '0')) {
    layers.unshift({
      id: 'layer:0',
      name: '0',
      visible: true,
      locked: false,
      color: toAciColor(7),
      lineWeight: -1
    })
  }

  return layers
}

function parseSectionRecords(pairs: DxfPair[], sectionName: 'BLOCKS' | 'ENTITIES'): DxfRecord[] {
  const records: DxfRecord[] = []
  let inSection = false
  let current: DxfRecord | null = null

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    if (pair.code === '0' && pair.value === 'SECTION' && pairs[index + 1]?.value === sectionName) {
      inSection = true
      current = null
      continue
    }
    if (!inSection) continue
    if (pair.code === '0' && pair.value === 'ENDSEC') {
      if (current) records.push(current)
      break
    }
    if (pair.code === '0') {
      if (current) records.push(current)
      current = { type: pair.value, pairs: [] }
      continue
    }
    current?.pairs.push(pair)
  }

  return records
}

function parseLine(record: DxfRecord, index: number): LineEntity {
  return {
    id: toEntityId('line', pairValue(record, '5'), index),
    kind: 'line',
    sourceType: 'LINE',
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    style: {
      color: toAciColor(pairInt(record, '62', 7)),
      lineWeight: pairInt(record, '370', -1),
      visible: true
    },
    start: { x: pairNumber(record, '10'), y: pairNumber(record, '20') },
    end: { x: pairNumber(record, '11'), y: pairNumber(record, '21') }
  }
}

function parseCircle(record: DxfRecord, index: number): CircleEntity {
  return {
    id: toEntityId('circle', pairValue(record, '5'), index),
    kind: 'circle',
    sourceType: 'CIRCLE',
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    style: {
      color: toAciColor(pairInt(record, '62', 7)),
      lineWeight: pairInt(record, '370', -1),
      visible: true
    },
    center: { x: pairNumber(record, '10'), y: pairNumber(record, '20') },
    radius: pairNumber(record, '40')
  }
}

function parseLwPolyline(record: DxfRecord, index: number): PolylineEntity {
  const xs = record.pairs.filter(pair => pair.code === '10').map(pair => Number(pair.value))
  const ys = record.pairs.filter(pair => pair.code === '20').map(pair => Number(pair.value))
  const vertices: Point2D[] = xs.map((x, vertexIndex) => ({
    x,
    y: Number.isFinite(ys[vertexIndex]) ? ys[vertexIndex] : 0
  }))
  return {
    id: toEntityId('lwpolyline', pairValue(record, '5'), index),
    kind: 'polyline',
    sourceType: 'LWPOLYLINE',
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    style: {
      color: toAciColor(pairInt(record, '62', 7)),
      lineWeight: pairInt(record, '370', -1),
      visible: true
    },
    vertices,
    closed: pairInt(record, '70', 0) === 1
  }
}

function parseText(record: DxfRecord, index: number): TextEntity {
  return {
    id: toEntityId('text', pairValue(record, '5'), index),
    kind: 'text',
    sourceType: 'TEXT',
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    text: pairValue(record, '1') ?? '',
    insertionPoint: { x: pairNumber(record, '10'), y: pairNumber(record, '20') },
    style: {
      height: pairNumber(record, '40', 2.5),
      rotation: pairNumber(record, '50', 0),
      color: toAciColor(pairInt(record, '62', 7))
    }
  }
}

function parseInsert(record: DxfRecord, index: number): BlockReferenceEntity {
  const scaleX = pairNumber(record, '41', 1)
  const scaleY = pairNumber(record, '42', 1)
  const rotationDegrees = pairNumber(record, '50', 0)
  const radians = (rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    id: toEntityId('insert', pairValue(record, '5'), index),
    kind: 'block-reference',
    sourceType: 'INSERT',
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    blockId: `block:${pairValue(record, '2')?.trim() || 'UNKNOWN'}`,
    transform: {
      a: cos * scaleX,
      b: sin * scaleX,
      c: -sin * scaleY,
      d: cos * scaleY,
      e: pairNumber(record, '10'),
      f: pairNumber(record, '20')
    },
    style: {
      color: toAciColor(pairInt(record, '62', 7)),
      visible: true
    },
    attributes: []
  }
}

function parseUnsupported(record: DxfRecord, index: number): UnsupportedEntity {
  return {
    id: toEntityId(record.type, pairValue(record, '5'), index),
    kind: 'unsupported',
    sourceType: record.type,
    layerId: toLayerId(pairValue(record, '8')?.trim() || '0'),
    metadata: { type: record.type }
  }
}

function parseEntityRecord(record: DxfRecord, index: number): DrawingEntity {
  switch (record.type) {
    case 'LINE':
      return parseLine(record, index)
    case 'CIRCLE':
      return parseCircle(record, index)
    case 'LWPOLYLINE':
      return parseLwPolyline(record, index)
    case 'TEXT':
      return parseText(record, index)
    case 'INSERT':
      return parseInsert(record, index)
    default:
      return parseUnsupported(record, index)
  }
}

function parseBlocks(records: DxfRecord[], diagnostics: DrawingDiagnostic[]): DrawingBlock[] {
  const blocks: DrawingBlock[] = []
  let currentName = ''
  let currentBasePoint = { x: 0, y: 0 }
  let currentEntities: DrawingEntity[] = []
  let open = false

  const flush = () => {
    if (!open) return
    blocks.push({
      id: `block:${currentName || 'UNKNOWN'}`,
      name: currentName || 'UNKNOWN',
      basePoint: currentBasePoint,
      entities: currentEntities
    })
    open = false
    currentName = ''
    currentBasePoint = { x: 0, y: 0 }
    currentEntities = []
  }

  records.forEach((record, index) => {
    if (record.type === 'BLOCK') {
      flush()
      open = true
      currentName = pairValue(record, '2')?.trim() || pairValue(record, '3')?.trim() || `BLOCK_${index}`
      currentBasePoint = {
        x: pairNumber(record, '10'),
        y: pairNumber(record, '20')
      }
      return
    }
    if (record.type === 'ENDBLK') {
      flush()
      return
    }
    if (open) {
      const entity = parseEntityRecord(record, currentEntities.length)
      currentEntities.push(entity)
      if (entity.kind === 'unsupported') {
        diagnostics.push({
          severity: 'warning',
          code: 'unsupported_dxf_entity',
          message: `Unsupported DXF entity type ${entity.sourceType} in block ${currentName}.`,
          entityId: entity.id,
          sourceType: entity.sourceType
        })
      }
    }
  })

  flush()
  return blocks
}

function collectPoints(entity: DrawingEntity, blocksById: Map<string, DrawingBlock>, depth = 0): Point2D[] {
  if (depth > 8) return []
  switch (entity.kind) {
    case 'line':
      return [entity.start, entity.end]
    case 'circle':
      return [
        { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
        { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
      ]
    case 'polyline':
      return entity.vertices
    case 'text':
      return [entity.insertionPoint]
    case 'mtext':
      return [entity.insertionPoint]
    case 'block-reference': {
      const block = blocksById.get(entity.blockId)
      if (!block) return [{ x: entity.transform.e, y: entity.transform.f }]
      const points: Point2D[] = []
      for (const child of block.entities) {
        for (const point of collectPoints(child, blocksById, depth + 1)) {
          points.push({
            x: entity.transform.a * point.x + entity.transform.c * point.y + entity.transform.e,
            y: entity.transform.b * point.x + entity.transform.d * point.y + entity.transform.f
          })
        }
      }
      return points
    }
    default:
      return []
  }
}

function computeBounds(entities: DrawingEntity[], blocks: DrawingBlock[]) {
  const blocksById = new Map(blocks.map(block => [block.id, block]))
  const points = entities.flatMap(entity => collectPoints(entity, blocksById))
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return {
    minX: Math.min(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)),
    maxY: Math.max(...points.map(point => point.y))
  }
}

async function parseDxfDocument(input: CadInput, options?: CadParseOptions): Promise<CadParseResult> {
  if (options?.signal?.aborted) {
    throw new Error('CAD parse aborted.')
  }

  const text = await readDxfText(input)
  const pairs = toPairs(text)
  const header = parseHeader(pairs)
  const layers = parseLayers(pairs)
  const diagnostics: DrawingDiagnostic[] = []
  const blocks = parseBlocks(parseSectionRecords(pairs, 'BLOCKS'), diagnostics)
  const entities = parseSectionRecords(pairs, 'ENTITIES').map((record, index) => {
    const entity = parseEntityRecord(record, index)
    if (entity.kind === 'unsupported') {
      diagnostics.push({
        severity: 'warning',
        code: 'unsupported_dxf_entity',
        message: `Unsupported DXF entity type ${entity.sourceType}.`,
        entityId: entity.id,
        sourceType: entity.sourceType
      })
    }
    return entity
  })

  const layout: DrawingLayout = {
    id: 'layout:model',
    name: 'Model',
    type: 'model',
    entities: entities.map(entity => entity.id)
  }

  const document: DrawingDocument = {
    schemaVersion: DRAWING_MODEL_SCHEMA_VERSION,
    id: `dxf:${input.relativePath ?? input.name}`,
    source: {
      fileName: input.name,
      format: 'dxf',
      version: header.version,
      sizeBytes: input.sizeBytes
    },
    units: 'unitless',
    bounds: computeBounds(entities, blocks),
    layers,
    layouts: [layout],
    blocks,
    entities,
    resources: {
      fonts: [],
      images: [],
      xrefs: []
    },
    diagnostics
  }

  return {
    document,
    diagnostics,
    adapterId: 'cadflux-direct-dxf-parser'
  }
}

async function readDxfText(input: CadInput): Promise<string> {
  if (input.bytes) {
    return new TextDecoder('utf8').decode(input.bytes)
  }
  if (input.path) {
    const { readFile } = await import('node:fs/promises')
    return readFile(input.path, 'utf8')
  }
  throw new Error(`DXF parsing requires bytes or a filesystem path for ${input.name}.`)
}

function createLegacyStubDocument(input: CadInput, diagnostics: DrawingDiagnostic[]): DrawingDocument {
  const format = inferFormat(input)
  return {
    schemaVersion: DRAWING_MODEL_SCHEMA_VERSION,
    id: `${format}:${input.relativePath ?? input.name}`,
    source: {
      fileName: input.name,
      format,
      sizeBytes: input.sizeBytes
    },
    units: 'unitless',
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    layers: [],
    layouts: [{ id: 'layout:model', name: 'Model', type: 'model', entities: [] }],
    blocks: [{ id: 'block:model-space', name: '*Model_Space', basePoint: { x: 0, y: 0 }, entities: [] }],
    entities: [{
      id: `unsupported:${format}:0`,
      kind: 'unsupported',
      sourceType: format.toUpperCase(),
      metadata: { adapter: 'mlightcad-legacy-inspection', transform: identityMatrix() }
    }],
    resources: { fonts: [], images: [], xrefs: [] },
    diagnostics
  }
}

export const mlightcadCadParserAdapter: CadParserAdapter = {
  id: 'mlightcad-legacy-inspection',
  formats: ['dwg', 'dxf'],
  async inspect(input: CadInput, _options?: CadParseOptions): Promise<CadInspectResult> {
    const source = toInputSource(input)
    const inspection =
      inferFormat(input) === 'dwg' ? inspectDwgInput(source) : inspectDxfInput(source)
    return {
      format: inspection.detectedFormat,
      warnings: toDiagnostics(inspection.warnings, inspection.detectedFormat)
    }
  },
  async parse(input: CadInput, options?: CadParseOptions): Promise<CadParseResult> {
    if (inferFormat(input) === 'dxf') {
      return parseDxfDocument(input, options)
    }
    const inspected =
      input.path != null
        ? await this.inspect(input, options)
        : {
            format: 'dwg' as const,
            warnings: [
              {
                severity: 'warning' as const,
                code: 'dwg_browser_preview_unavailable',
                message:
                  'DWG preview is not available in the lightweight browser viewer without a filesystem-backed parser path.',
                sourceType: 'dwg'
              }
            ]
          }
    const document = createLegacyStubDocument(input, inspected.warnings)
    return {
      document,
      diagnostics: inspected.warnings,
      adapterId: this.id
    }
  }
}
