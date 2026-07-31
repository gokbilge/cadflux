#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const targetDirectory = process.argv[2]

if (!targetDirectory) {
  console.error('Usage: node tools/fix-esm-specifiers.mjs <directory>')
  process.exit(1)
}

const absoluteTargetDirectory = path.resolve(targetDirectory)
await processDirectory(absoluteTargetDirectory)

async function processDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await processDirectory(absolutePath)
      continue
    }
    if (!shouldRewriteFile(entry.name)) {
      continue
    }
    await rewriteFile(absolutePath)
  }
}

function shouldRewriteFile(fileName) {
  return (
    fileName.endsWith('.js') ||
    fileName.endsWith('.d.ts') ||
    fileName.endsWith('.d.mts') ||
    fileName.endsWith('.mjs')
  )
}

async function rewriteFile(absolutePath) {
  const original = await readFile(absolutePath, 'utf8')
  const rewritten = rewriteRelativeSpecifiers(original)
  if (rewritten !== original) {
    await writeFile(absolutePath, rewritten, 'utf8')
  }
}

function rewriteRelativeSpecifiers(source) {
  const importExportPattern =
    /((?:import|export)\s[\s\S]*?\sfrom\s*)(['"])(\.\.?(?:\/[^'"]*)?)(\2)/g
  const dynamicImportPattern = /(import\s*\(\s*)(['"])(\.\.?(?:\/[^'"]*)?)(\2)(\s*\))/g

  return source
    .replace(importExportPattern, (_match, prefix, quote, specifier, suffixQuote) => {
      return `${prefix}${quote}${normalizeSpecifier(specifier)}${suffixQuote}`
    })
    .replace(
      dynamicImportPattern,
      (_match, prefix, quote, specifier, suffixQuote, suffixParen) => {
        return `${prefix}${quote}${normalizeSpecifier(specifier)}${suffixQuote}${suffixParen}`
      }
    )
}

function normalizeSpecifier(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier
  }

  if (hasRuntimeExtension(specifier)) {
    return specifier
  }

  if (specifier.endsWith('.ts')) {
    return `${specifier.slice(0, -3)}.js`
  }
  if (specifier.endsWith('.mts')) {
    return `${specifier.slice(0, -4)}.mjs`
  }
  if (specifier.endsWith('.cts')) {
    return `${specifier.slice(0, -4)}.cjs`
  }

  return `${specifier}.js`
}

function hasRuntimeExtension(specifier) {
  return [
    '.js',
    '.mjs',
    '.cjs',
    '.json',
    '.node',
    '.css',
    '.wasm'
  ].some(extension => specifier.endsWith(extension))
}
