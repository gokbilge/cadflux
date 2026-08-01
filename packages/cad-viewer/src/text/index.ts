import { AcApLocale } from '@mlightcad/cad-simple-viewer'
import { AcDbEntity } from '@mlightcad/data-model'

import enCommand from '../locale/en/command'
import enDialog from '../locale/en/dialog'
import enEntity from '../locale/en/entity'
import enMain from '../locale/en/main'

export type LocaleProp = AcApLocale | 'default'

export const viewerText = {
  main: enMain,
  command: enCommand,
  dialog: enDialog,
  entity: enEntity
} as const

export function formatText(
  template: string,
  values: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key]
    return value == null ? '' : String(value)
  })
}

export function entityName(entity: AcDbEntity | { type: string }): string {
  const match = viewerText.entity.entityName[
    entity.type as keyof typeof viewerText.entity.entityName
  ]
  return match ?? entity.type
}

export function entityPropName(name: string): string {
  const match = viewerText.entity.property[
    name as keyof typeof viewerText.entity.property
  ]
  return match ?? name
}

export function entityPropEnum(name: string): string {
  const match = viewerText.entity.enum[
    name as keyof typeof viewerText.entity.enum
  ]
  return match ?? name
}

export function colorName(colorKeyName: string): string {
  if (colorKeyName === 'ByLayer' || colorKeyName === 'ByBlock') {
    return colorKeyName
  }
  const key = colorKeyName.toLowerCase() as keyof typeof viewerText.entity.color
  return viewerText.entity.color[key] ?? colorKeyName
}

export function toolPaletteTitle(name: string): string {
  const palette = viewerText.main.toolPalette[
    name as keyof typeof viewerText.main.toolPalette
  ] as { title?: string } | undefined
  return palette?.title ?? name
}

export function toolPaletteTabName(name: string): string {
  const palette = viewerText.main.toolPalette[
    name as keyof typeof viewerText.main.toolPalette
  ] as { tab?: string } | undefined
  return palette?.tab ?? name
}

export function notificationDaysAgo(count: number): string {
  return formatText(viewerText.main.notification.time.daysAgo, { count })
}

export function notificationHoursAgo(count: number): string {
  return formatText(viewerText.main.notification.time.hoursAgo, { count })
}

export function notificationMinutesAgo(count: number): string {
  return formatText(viewerText.main.notification.time.minutesAgo, { count })
}
