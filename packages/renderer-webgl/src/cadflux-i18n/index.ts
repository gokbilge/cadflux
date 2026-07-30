// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { AcApI18n, type AcApLocale } from './AcApI18n'
import enCommand from '../../../cad-simple-viewer/src/i18n/en/command'
import enJig from '../../../cad-simple-viewer/src/i18n/en/jig'
import enMain from '../../../cad-simple-viewer/src/i18n/en/main'

AcApI18n.mergeLocaleMessage('en', {
  command: enCommand,
  jig: enJig,
  main: enMain
})

export const cmdDescription = (groupName: string, cmdName: string) => {
  const key = `command.${groupName}.${cmdName}`
  return AcApI18n.t(key)
}

export const sysCmdDescription = (name: string) => {
  return cmdDescription('ACAD', name)
}

export const userCmdDescription = (name: string) => {
  return cmdDescription('USER', name)
}

export { AcApI18n, type AcApLocale }
