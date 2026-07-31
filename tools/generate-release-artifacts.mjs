#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(rootDir, 'artifacts', 'release')
const packagesDir = path.join(rootDir, 'packages')
const cliPackageJsonPath = path.join(rootDir, 'apps', 'cli', 'package.json')
const webDistDir = path.join(rootDir, 'apps', 'web', 'dist')

const publishedPackages = [
  '@cadflux/core',
  '@cadflux/file-ingest',
  '@cadflux/dwg-adapter',
  '@cadflux/dxf-adapter',
  '@cadflux/drawing-model',
  '@cadflux/plot-engine',
  '@cadflux/renderer-svg',
  '@cadflux/renderer-pdf',
  '@cadflux/batch-engine',
  '@cadflux/diagnostics',
  '@cadflux/presets',
  '@cadflux/cli'
]

await rm(releaseDir, { recursive: true, force: true })
await mkdir(releaseDir, { recursive: true })

const version = process.argv[2] ?? readVersionFromRootPackage()
const gitTag = `v${version}`
const lastTag = findPreviousTag(gitTag)
const commits = readCommitsSince(lastTag)
const packageRecords = await readPublishedPackages()
const compatibility = buildCompatibilityReport(packageRecords)

await createSourceArchive(version)
await createWebArchive(version)
await writeJsonArtifact('sbom.json', buildSbom(version, packageRecords))
await writeJsonArtifact('compatibility-report.json', compatibility)
await writeTextArtifact(
  'compatibility-report.md',
  renderCompatibilityMarkdown(version, compatibility)
)
await writeTextArtifact(
  'release-notes.md',
  renderReleaseNotes(version, lastTag, commits)
)
await writeJsonArtifact('release-manifest.json', {
  version,
  generatedAt: new Date().toISOString(),
  publishedPackages,
  artifacts: await collectArtifactList()
})
await writeTextArtifact('checksums.txt', await buildChecksums())

console.log(`Release artifacts generated in ${releaseDir}`)

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim()
}

function readVersionFromRootPackage() {
  const pkg = JSON.parse(
    execFileSync('node', ['-e', "process.stdout.write(JSON.stringify(require('./package.json')))"], {
      cwd: rootDir,
      encoding: 'utf8'
    })
  )
  return pkg.version
}

function findPreviousTag(currentTag) {
  const tags = runGit(['tag', '--list', 'v*.*.*'])
    .split('\n')
    .map(tag => tag.trim())
    .filter(Boolean)
    .filter(tag => tag !== currentTag)
  return tags.at(-1) ?? null
}

function readCommitsSince(previousTag) {
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD'
  const output = runGit(['log', '--pretty=format:%h%x09%s', range])
  return output ? output.split('\n').map(line => line.trim()) : []
}

async function readPublishedPackages() {
  const records = []

  for (const dirent of await readdir(packagesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue
    }
    const packageJsonPath = path.join(packagesDir, dirent.name, 'package.json')
    try {
      const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'))
      if (publishedPackages.includes(pkg.name)) {
        records.push({
          name: pkg.name,
          version: pkg.version,
          license: pkg.license,
          path: path.relative(rootDir, path.dirname(packageJsonPath)).replaceAll('\\', '/')
        })
      }
    } catch {
      // ignore
    }
  }

  const cliPkg = JSON.parse(await readFile(cliPackageJsonPath, 'utf8'))
  records.push({
    name: cliPkg.name,
    version: cliPkg.version,
    license: cliPkg.license,
    path: 'apps/cli'
  })

  return records.sort((left, right) => left.name.localeCompare(right.name))
}

function buildCompatibilityReport(packageRecords) {
  return {
    platformScope: {
      browser: true,
      nodeCli: true,
      reusableTypeScriptPackages: true,
      desktop: false
    },
    cliPlatforms: ['Windows', 'Linux', 'macOS'],
    webTargets: [
      'GitHub Pages',
      'Cloudflare Pages',
      'Netlify',
      'Vercel',
      'Static web server',
      'Internal web server'
    ],
    publishedPackages: packageRecords.map(record => record.name),
    outputs: [
      'Source archive',
      'Static web build archive',
      'Checksums',
      'SBOM',
      'Release notes',
      'Compatibility report'
    ]
  }
}

function buildSbom(version, packageRecords) {
  return {
    bomFormat: 'CycloneDX-like',
    specVersion: '1.0',
    serialNumber: `urn:uuid:${globalThis.crypto.randomUUID()}`,
    version: 1,
    metadata: {
      component: {
        name: 'cadflux',
        version,
        type: 'application',
        licenses: [{ license: { id: 'GPL-3.0-or-later' } }]
      }
    },
    components: packageRecords.map(record => ({
      type: record.name === '@cadflux/cli' ? 'application' : 'library',
      name: record.name,
      version: record.version,
      licenses: [{ license: { id: record.license } }],
      purl: `pkg:npm/${record.name}@${record.version}`,
      properties: [{ name: 'workspacePath', value: record.path }]
    }))
  }
}

async function createSourceArchive(version) {
  const targetPath = path.join(releaseDir, `cadflux-source-${version}.tar.gz`)
  runGit(['archive', '--format=tar.gz', `--output=${targetPath}`, 'HEAD'])
}

async function createWebArchive(version) {
  try {
    await stat(webDistDir)
  } catch {
    return
  }

  const targetPath = path.join(releaseDir, `cadflux-web-dist-${version}.tar.gz`)
  execFileSync('tar', ['-czf', targetPath, '-C', webDistDir, '.'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

async function writeJsonArtifact(fileName, data) {
  await writeTextArtifact(fileName, `${JSON.stringify(data, null, 2)}\n`)
}

async function writeTextArtifact(fileName, content) {
  await writeFile(path.join(releaseDir, fileName), content, 'utf8')
}

async function collectArtifactList() {
  const files = await readdir(releaseDir)
  return files.sort()
}

async function buildChecksums() {
  const lines = []
  const files = (await readdir(releaseDir))
    .filter(fileName => fileName !== 'checksums.txt')
    .sort()

  for (const fileName of files) {
    const buffer = await readFile(path.join(releaseDir, fileName))
    const digest = createHash('sha256').update(buffer).digest('hex')
    lines.push(`${digest}  ${fileName}`)
  }

  return `${lines.join('\n')}\n`
}

function renderReleaseNotes(version, previousTag, commits) {
  const lines = [
    `# CadFlux ${version}`,
    '',
    previousTag
      ? `Changes since ${previousTag}.`
      : 'Initial generated release notes from the current repository state.',
    '',
    '## Included release outputs',
    '',
    '- Source archive',
    '- Static web build archive',
    '- Checksums',
    '- SBOM',
    '- Compatibility report',
    '',
    '## Commits',
    ''
  ]

  if (commits.length === 0) {
    lines.push('- No commits found in range.')
  } else {
    for (const commit of commits) {
      lines.push(`- ${commit}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function renderCompatibilityMarkdown(version, compatibility) {
  return `# CadFlux compatibility report

Version: ${version}

## Product surfaces

- Browser web application: ${compatibility.platformScope.browser ? 'supported' : 'not supported'}
- Node.js CLI: ${compatibility.platformScope.nodeCli ? 'supported' : 'not supported'}
- Reusable TypeScript packages: ${compatibility.platformScope.reusableTypeScriptPackages ? 'supported' : 'not supported'}
- Desktop application: ${compatibility.platformScope.desktop ? 'supported' : 'not supported'}

## CLI platforms

${compatibility.cliPlatforms.map(platform => `- ${platform}`).join('\n')}

## Web deployment targets

${compatibility.webTargets.map(target => `- ${target}`).join('\n')}

## Published packages

${compatibility.publishedPackages.map(pkg => `- ${pkg}`).join('\n')}

## Release outputs

${compatibility.outputs.map(output => `- ${output}`).join('\n')}
`
}
