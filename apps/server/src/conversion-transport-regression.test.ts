// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readFileSync } from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')

describe('conversion transport regression guards', () => {
  test.each([
    'packages/renderer-pdf/src/node.ts',
    'packages/renderer-svg/src/node.ts'
  ])('%s does not expand file bytes into number arrays', relativePath => {
    const source = readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8')

    expect(source).not.toContain('[...fileBytes]')
    expect(source).not.toContain('Array.from(fileBytes)')
  })

  test.each([
    'packages/renderer-pdf/src/node.ts',
    'packages/renderer-svg/src/node.ts',
    'apps/cli/src/cli.ts'
  ])('%s no longer depends on playwright', relativePath => {
    const source = readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8')
    expect(source).not.toContain('playwright')
    expect(source).not.toContain('chromium')
    expect(source).not.toContain('browser.newPage')
    expect(source).not.toContain('page.evaluate')
  })
})
