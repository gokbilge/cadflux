// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'minimization')
const DOCS_DIR = path.join(ROOT, 'docs', 'minimization')
const FAST_MODE = process.env.CADFLUX_MINIMIZE_FULL !== '1'

await mkdir(ARTIFACTS_DIR, { recursive: true })
await mkdir(DOCS_DIR, { recursive: true })

const rootScan = await scanDirectory(ROOT, { excludeNames: new Set(['.git', 'node_modules', '.nx']) })
const nodeModulesMeasurement = FAST_MODE
  ? await approximateNodeModulesSize(path.join(ROOT, 'node_modules'))
  : await exactDirectoryMeasurement(path.join(ROOT, 'node_modules'))
const gitMeasurement = FAST_MODE
  ? await approximateGitSize(path.join(ROOT, '.git'))
  : await exactDirectoryMeasurement(path.join(ROOT, '.git'))
const nodeModulesSize = nodeModulesMeasurement.size
const gitSize = gitMeasurement.size
const workTreeWithoutGit = rootScan.totalSize + nodeModulesSize
const sourceTreeWithoutGitAndNodeModules = rootScan.totalSize

const report = {
  generatedAt: new Date().toISOString(),
  mode: FAST_MODE ? 'fast' : 'full',
  repo: {
    workingTreeExcludingGit: workTreeWithoutGit,
    sourceTreeExcludingGitAndNodeModules: sourceTreeWithoutGitAndNodeModules,
    gitSize,
    nodeModulesSize,
    gitMeasurement,
    nodeModulesMeasurement
  },
  workspaceDirectories: measureTopLevelWorkspaceDirs(rootScan),
  topFiles: rootScan.files.slice(0, 50),
  topDirectories: rootScan.directories.slice(0, 50),
  installedDependencyPackages: FAST_MODE ? [] : await topInstalledPackages(50),
  generatedAssets: await topGeneratedAssets(50, rootScan),
  runtimeReports: FAST_MODE ? skippedRuntimeReports() : await measureRuntimeDeployments(),
  docker: FAST_MODE ? skippedDockerReport() : await measureDocker(),
  playwright: await measurePlaywright(),
  webBundle: await measureWebBundle()
}

await writeFile(path.join(ARTIFACTS_DIR, 'size-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'size-report.md'), renderSizeMarkdown(report), 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'server-runtime-report.md'), renderRuntimeMarkdown('server', report.runtimeReports.server), 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'cli-runtime-report.md'), renderRuntimeMarkdown('cli', report.runtimeReports.cli), 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'docker-image-report.json'), `${JSON.stringify(report.docker, null, 2)}\n`, 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'docker-image-report.md'), renderDockerMarkdown(report.docker), 'utf8')
await writeFile(path.join(DOCS_DIR, 'baseline.md'), renderBaselineMarkdown(report), 'utf8')

console.log(JSON.stringify({
  repoSize: report.repo.workingTreeExcludingGit,
  nodeModulesSize: report.repo.nodeModulesSize,
  topWorkspaceCount: report.workspaceDirectories.length
}, null, 2))

async function directorySize(targetPath, options = {}) {
  if (!existsSync(targetPath)) {
    return 0
  }
  const excludeNames = options.excludeNames ?? new Set()
  const info = await stat(targetPath)
  if (!info.isDirectory()) {
    return info.size
  }
  let total = 0
  for (const entry of await readdir(targetPath, { withFileTypes: true })) {
    if (excludeNames.has(entry.name)) {
      continue
    }
    total += await directorySize(path.join(targetPath, entry.name), options)
  }
  return total
}

async function exactDirectoryMeasurement(targetPath, options = {}) {
  return {
    mode: 'exact',
    size: await directorySize(targetPath, options)
  }
}

async function approximateNodeModulesSize(targetPath) {
  if (!existsSync(targetPath)) {
    return {
      mode: 'missing',
      size: 0
    }
  }
  const cachePath = path.join(ARTIFACTS_DIR, 'size-report.json')
  if (existsSync(cachePath)) {
    const cached = safeJsonParse(await readText(cachePath))
    const cachedSize = cached?.repo?.nodeModulesSize
    if (Number.isFinite(cachedSize) && cachedSize > 0) {
      return {
        mode: 'cached',
        size: cachedSize,
        source: 'artifacts/minimization/size-report.json'
      }
    }
  }
  const topLevelEntries = await readdir(targetPath, { withFileTypes: true })
  const directStats = []
  let directTotal = 0
  for (const entry of topLevelEntries) {
    const fullPath = path.join(targetPath, entry.name)
    const details = await stat(fullPath)
    directStats.push({
      path: path.relative(ROOT, fullPath).replace(/\\/g, '/'),
      size: details.size,
      directory: details.isDirectory()
    })
    directTotal += details.size
  }
  return {
    mode: 'approximate-direct-stat',
    size: directTotal,
    note: 'Fast mode does not recurse through node_modules. Run full mode for exact size.',
    topLevelEntries: directStats.sort((a, b) => b.size - a.size).slice(0, 20)
  }
}

async function approximateGitSize(targetPath) {
  if (!existsSync(targetPath)) {
    return {
      mode: 'missing',
      size: 0
    }
  }
  const countObjects = spawnSync('git', ['count-objects', '-v'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  if (countObjects.status === 0) {
    const map = Object.fromEntries(
      countObjects.stdout
        .split(/\r?\n/u)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.split(':').map(part => part.trim()))
        .filter(parts => parts.length === 2)
    )
    const kib = Number(map['size'] ?? 0) + Number(map['size-pack'] ?? 0)
    return {
      mode: 'git-count-objects',
      size: Math.round(kib * 1024),
      note: 'Approximate .git content size from git count-objects.'
    }
  }
  return {
    mode: 'approximate-direct-stat',
    size: (await stat(targetPath)).size
  }
}

function measureTopLevelWorkspaceDirs(rootDirectoryScan) {
  return rootDirectoryScan.directories
    .filter(item => {
      const parts = item.path.split('/')
      return parts.length === 2 && (parts[0] === 'apps' || parts[0] === 'packages')
    })
    .sort((a, b) => b.size - a.size)
}

async function topFiles(dir, limit, state = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.nx'].includes(entry.name)) {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await topFiles(fullPath, limit, state)
      continue
    }
    const details = await stat(fullPath)
    state.push({
      path: path.relative(ROOT, fullPath).replace(/\\/g, '/'),
      size: details.size
    })
  }
  return state.sort((a, b) => b.size - a.size).slice(0, limit)
}

async function topDirectories(dir, limit, state = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.nx'].includes(entry.name)) {
      continue
    }
    if (!entry.isDirectory()) {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    state.push({
      path: path.relative(ROOT, fullPath).replace(/\\/g, '/'),
      size: await directorySize(fullPath)
    })
    await topDirectories(fullPath, limit, state)
  }
  return state.sort((a, b) => b.size - a.size).slice(0, limit)
}

async function scanDirectory(dir, options = {}) {
  const excludeNames = options.excludeNames ?? new Set()
  const relativeBase = options.relativeBase ?? ROOT
  const files = []
  const directories = []

  async function walk(currentPath) {
    const details = await stat(currentPath)
    if (!details.isDirectory()) {
      return {
        totalSize: details.size
      }
    }

    let totalSize = 0
    for (const entry of await readdir(currentPath, { withFileTypes: true })) {
      if (excludeNames.has(entry.name)) {
        continue
      }
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        const nested = await walk(fullPath)
        totalSize += nested.totalSize
      } else {
        const fileDetails = await stat(fullPath)
        totalSize += fileDetails.size
        files.push({
          path: path.relative(relativeBase, fullPath).replace(/\\/g, '/'),
          size: fileDetails.size
        })
      }
    }

    if (currentPath !== dir) {
      directories.push({
        path: path.relative(relativeBase, currentPath).replace(/\\/g, '/'),
        size: totalSize
      })
    }
    return { totalSize }
  }

  const result = await walk(dir)
  return {
    totalSize: result.totalSize,
    files: files.sort((a, b) => b.size - a.size),
    directories: directories.sort((a, b) => b.size - a.size)
  }
}

async function topInstalledPackages(limit) {
  const base = path.join(ROOT, 'node_modules', '.pnpm')
  if (!existsSync(base)) {
    return []
  }
  const scan = await scanDirectory(base, { relativeBase: ROOT })
  return scan.directories
    .filter(item => item.path.startsWith('node_modules/.pnpm/') && item.path.split('/').length === 3)
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
}

async function topGeneratedAssets(limit, rootDirectoryScan) {
  if (FAST_MODE) {
    return rootDirectoryScan.directories
      .filter(item =>
        item.path === 'apps/web/dist' ||
        item.path === 'apps/server/dist' ||
        item.path === 'apps/cli/dist' ||
        item.path.endsWith('/dist-runner')
      )
      .sort((a, b) => b.size - a.size)
      .slice(0, limit)
  }
  const targets = []
  for (const folder of ['apps', 'packages']) {
    const base = path.join(ROOT, folder)
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      for (const generatedName of ['dist', 'dist-runner']) {
        const fullPath = path.join(base, entry.name, generatedName)
        if (!existsSync(fullPath)) {
          continue
        }
        const scan = await scanDirectory(fullPath, { relativeBase: ROOT })
        targets.push({
          path: path.relative(ROOT, fullPath).replace(/\\/g, '/'),
          size: scan.totalSize
        })
      }
    }
  }
  return targets.sort((a, b) => b.size - a.size).slice(0, limit)
}

async function measureRuntimeDeployments() {
  const deployRoot = path.join(ARTIFACTS_DIR, 'deploy')
  await mkdir(deployRoot, { recursive: true })
  const result = {
    server: await attemptDeploy('@cadflux/server', path.join(deployRoot, 'server')),
    cli: await attemptDeploy('@cadflux/cli', path.join(deployRoot, 'cli'))
  }
  return result
}

function skippedRuntimeReports() {
  return {
    server: {
      skipped: true,
      reason: 'Fast mode enabled. Set CADFLUX_MINIMIZE_FULL=1 to run production deploy measurement.'
    },
    cli: {
      skipped: true,
      reason: 'Fast mode enabled. Set CADFLUX_MINIMIZE_FULL=1 to run production deploy measurement.'
    }
  }
}

async function attemptDeploy(filter, targetDir) {
  await rm(targetDir, { recursive: true, force: true }).catch(() => undefined)
  const run = spawnSync('pnpm.cmd', ['deploy', '--legacy', '--filter', filter, '--prod', targetDir], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  return {
    filter,
    exitCode: run.status,
    size: await directorySize(targetDir).catch(() => 0),
    stdout: (run.stdout ?? '').trim(),
    stderr: (run.stderr ?? '').trim()
  }
}

async function measureDocker() {
  const availability = spawnSync('docker', ['version'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  if (availability.status !== 0) {
    return {
      available: false,
      buildExitCode: availability.status,
      stderr: availability.stderr,
      stdout: availability.stdout
    }
  }
  const tag = `cadflux-min-baseline:${Date.now()}`
  const build = spawnSync('docker', ['build', '.', '-t', tag], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  if (build.status !== 0) {
    return {
      available: false,
      buildExitCode: build.status,
      stderr: build.stderr,
      stdout: build.stdout
    }
  }
  const inspect = spawnSync('docker', ['image', 'inspect', tag], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  const history = spawnSync('docker', ['history', '--no-trunc', '--format', '{{json .}}', tag], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false
  })
  return {
    available: true,
    tag,
    inspect: safeJsonParse(inspect.stdout)?.[0] ?? null,
    history: history.stdout.split(/\r?\n/u).filter(Boolean).map(line => safeJsonParse(line))
  }
}

function skippedDockerReport() {
  return {
    available: false,
    skipped: true,
    reason: 'Fast mode enabled. Set CADFLUX_MINIMIZE_FULL=1 to run Docker measurement.'
  }
}

async function measurePlaywright() {
  const runnerDirSizes = []
  for (const runner of ['packages/renderer-pdf/dist-runner', 'packages/renderer-svg/dist-runner']) {
    const fullPath = path.join(ROOT, runner)
    if (existsSync(fullPath)) {
      runnerDirSizes.push({
        path: runner,
        size: FAST_MODE ? (await scanDirectory(fullPath)).totalSize : await directorySize(fullPath)
      })
    }
  }
  const browserPathCommand = spawnSync(
    'pnpm.cmd',
    ['--filter', '@cadflux/renderer-pdf', 'exec', 'node', '-e', "import('playwright').then(({ chromium }) => console.log(chromium.executablePath()))"],
    { cwd: ROOT, encoding: 'utf8', shell: false }
  )
  const executablePath = (browserPathCommand.stdout ?? '').trim()
  return {
    commandExitCode: browserPathCommand.status,
    commandStderr: (browserPathCommand.stderr ?? '').trim(),
    executablePath,
    executableSize: executablePath && existsSync(executablePath) ? (await stat(executablePath)).size : 0,
    runnerAssets: runnerDirSizes,
    playwrightPackageSize: await directorySize(path.join(ROOT, 'packages', 'renderer-pdf', 'node_modules', 'playwright')).catch(() => 0)
  }
}

async function measureWebBundle() {
  const distDir = path.join(ROOT, 'apps', 'web', 'dist')
  if (!existsSync(distDir)) {
    return {
      available: false
    }
  }
  const files = await collectFiles(distDir)
  const assets = []
  for (const file of files) {
    const buffer = await readFileCompat(file)
    assets.push({
      path: path.relative(ROOT, file).replace(/\\/g, '/'),
      rawBytes: buffer.length,
      gzipBytes: gzipSync(buffer).length,
      brotliBytes: brotliCompressSync(buffer).length
    })
  }
  return {
    available: true,
    totalRawBytes: assets.reduce((sum, item) => sum + item.rawBytes, 0),
    assets: assets.sort((a, b) => b.rawBytes - a.rawBytes)
  }
}

async function collectFiles(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files)
    } else {
      files.push(fullPath)
    }
  }
  return files
}

async function readFileCompat(filePath) {
  return await import('node:fs/promises').then(mod => mod.readFile(filePath))
}

async function readText(filePath) {
  return await import('node:fs/promises').then(mod => mod.readFile(filePath, 'utf8'))
}

function renderSizeMarkdown(report) {
  return [
    '# Size report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Repository working tree excluding .git: ${formatBytes(report.repo.workingTreeExcludingGit)}`,
    `- Source tree excluding .git and node_modules: ${formatBytes(report.repo.sourceTreeExcludingGitAndNodeModules)}`,
    `- .git: ${formatBytes(report.repo.gitSize)}`,
    `- node_modules: ${formatBytes(report.repo.nodeModulesSize)} (${report.repo.nodeModulesMeasurement.mode})`,
    '',
    '## Top 50 files',
    '',
    ...report.topFiles.map(item => `- ${item.path}: ${formatBytes(item.size)}`),
    '',
    '## Top 50 directories',
    '',
    ...report.topDirectories.map(item => `- ${item.path}: ${formatBytes(item.size)}`)
  ].join('\n')
}

function renderRuntimeMarkdown(name, report) {
  if (report.skipped) {
    return [
      `# ${name} runtime report`,
      '',
      `- Skipped: ${report.reason}`
    ].join('\n')
  }
  return [
    `# ${name} runtime report`,
    '',
    `- Deploy exit code: ${report.exitCode}`,
    `- Deploy size: ${formatBytes(report.size)}`,
    '',
    '## stdout',
    '',
    '```text',
    report.stdout || '',
    '```',
    '',
    '## stderr',
    '',
    '```text',
    report.stderr || '',
    '```'
  ].join('\n')
}

function renderDockerMarkdown(report) {
  if (report.skipped) {
    return [
      '# Docker image report',
      '',
      `- Skipped: ${report.reason}`
    ].join('\n')
  }
  if (!report.available) {
    return [
      '# Docker image report',
      '',
      '- Docker build was not available in this environment.',
      '',
      '## stdout',
      '',
      '```text',
      report.stdout || '',
      '```',
      '',
      '## stderr',
      '',
      '```text',
      report.stderr || '',
      '```'
    ].join('\n')
  }
  const size = report.inspect?.Size ?? 0
  return [
    '# Docker image report',
    '',
    `- Image tag: ${report.tag}`,
    `- Virtual size: ${formatBytes(size)}`,
    '',
    '## Largest layers',
    '',
    ...(report.history ?? []).slice(0, 20).map(layer => `- ${layer.Size}: ${layer.CreatedBy}`)
  ].join('\n')
}

function renderBaselineMarkdown(report) {
  return [
    '# CadFlux minimization baseline',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    '',
    `- Repository working tree size: ${formatBytes(report.repo.workingTreeExcludingGit)}`,
    `- node_modules size: ${formatBytes(report.repo.nodeModulesSize)} (${report.repo.nodeModulesMeasurement.mode})`,
    `- Web bundle size: ${report.webBundle.available ? formatBytes(report.webBundle.totalRawBytes) : 'not built yet'}`,
    `- Docker image size: ${report.docker.available ? formatBytes(report.docker.inspect?.Size ?? 0) : 'docker unavailable'}`,
    `- Playwright browser executable size: ${formatBytes(report.playwright.executableSize)}`,
    '',
    'Fast mode skips Docker and production deploy measurement by default. Set `CADFLUX_MINIMIZE_FULL=1` for the slower full baseline.'
  ].join('\n')
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}
