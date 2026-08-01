// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const DOCS_DIR = path.join(ROOT, 'docs', 'minimization')
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'minimization')
const PRODUCTION_ROOTS = new Set(['@cadflux/web', '@cadflux/server', '@cadflux/cli'])
const PACKAGE_DIRS = ['apps', 'packages']
const WORKSPACE_NAME_BY_DIR = new Map()
const ACTIVE_WORKSPACE_DIRS = loadActiveWorkspaceDirs()

await mkdir(DOCS_DIR, { recursive: true })
await mkdir(ARTIFACTS_DIR, { recursive: true })

const workspaces = await loadWorkspaces()
for (const workspace of workspaces) {
  WORKSPACE_NAME_BY_DIR.set(path.normalize(workspace.dir), workspace.name)
}

const repoFiles = await listRepoFiles(ROOT)
const scans = await scanRepoFiles(repoFiles, workspaces)

for (const workspace of workspaces) {
  workspace.directDependents = workspaces
    .filter(candidate => candidate.manifestWorkspaceDeps.some(dep => dep.target === workspace.name))
    .map(candidate => candidate.name)
    .sort()

  workspace.sourceImporters = scans.workspaceImporters.get(workspace.name) ?? []
  workspace.buildImporters = workspace.sourceImporters.filter(item => item.context === 'build')
  workspace.runtimeImporters = workspace.sourceImporters.filter(item => item.context === 'runtime')
  workspace.testImporters = workspace.sourceImporters.filter(item => item.context === 'test')
  workspace.productionReachable = false
}

const graph = buildWorkspaceGraph(workspaces, scans)
const reachable = computeReachablePackages(workspaces, graph, [...PRODUCTION_ROOTS])
for (const workspace of workspaces) {
  workspace.productionReachable = reachable.has(workspace.name)
}

const i18nAudit = await analyzeI18n(scans.i18nMatches)
const mlightcadAudit = analyzeMlightcad(scans.mlightcadMatches, workspaces)
const playwrightAudit = analyzePlaywright(scans.playwrightMatches)
const classification = classifyPackages(workspaces, mlightcadAudit, playwrightAudit, i18nAudit)
const deletionPlan = buildDeletionPlan(workspaces, classification)

await writeJson(path.join(DOCS_DIR, 'workspace-inventory.json'), {
  generatedAt: new Date().toISOString(),
  workspaceCount: workspaces.length,
  activeWorkspaceCount: workspaces.filter(workspace => workspace.activeWorkspace).length,
  workspaces
})
await writeFile(
  path.join(DOCS_DIR, 'workspace-inventory.md'),
  renderWorkspaceInventoryMarkdown(workspaces, classification),
  'utf8'
)

await writeJson(path.join(ARTIFACTS_DIR, 'workspace-graph.json'), graph)
await writeFile(path.join(ARTIFACTS_DIR, 'workspace-graph.md'), renderWorkspaceGraphMarkdown(graph), 'utf8')
await writeFile(path.join(ARTIFACTS_DIR, 'workspace-graph.dot'), renderDotGraph(graph), 'utf8')
await writeJson(
  path.join(ARTIFACTS_DIR, 'production-reachable-packages.json'),
  {
    generatedAt: new Date().toISOString(),
    productionRoots: [...PRODUCTION_ROOTS],
    packages: workspaces.filter(workspace => reachable.has(workspace.name)).map(minWorkspace)
  }
)
await writeJson(
  path.join(ARTIFACTS_DIR, 'non-production-packages.json'),
  {
    generatedAt: new Date().toISOString(),
    packages: workspaces.filter(workspace => !reachable.has(workspace.name)).map(minWorkspace)
  }
)

await writeFile(path.join(DOCS_DIR, 'mlightcad-usage.md'), renderMlightcadMarkdown(mlightcadAudit), 'utf8')
await writeFile(path.join(DOCS_DIR, 'playwright-usage.md'), renderPlaywrightMarkdown(playwrightAudit), 'utf8')
await writeFile(path.join(DOCS_DIR, 'i18n-usage.md'), renderI18nMarkdown(i18nAudit), 'utf8')
await writeJson(path.join(ARTIFACTS_DIR, 'english-ui-strings.json'), i18nAudit.englishUiStrings)
await writeFile(
  path.join(DOCS_DIR, 'package-classification.md'),
  renderPackageClassificationMarkdown(workspaces, classification),
  'utf8'
)
await writeFile(
  path.join(DOCS_DIR, 'deletion-plan.md'),
  renderDeletionPlanMarkdown(deletionPlan),
  'utf8'
)

console.log(JSON.stringify({
  workspaceCount: workspaces.length,
  activeWorkspaceCount: workspaces.filter(workspace => workspace.activeWorkspace).length,
  productionReachableCount: workspaces.filter(workspace => reachable.has(workspace.name)).length,
  mlightcadPackages: mlightcadAudit.packages.length,
  i18nFiles: i18nAudit.files.length,
  playwrightCallSites: playwrightAudit.callSites.length
}, null, 2))

function loadActiveWorkspaceDirs() {
  const workspaceConfigPath = path.join(ROOT, 'pnpm-workspace.yaml')
  if (!existsSync(workspaceConfigPath)) {
    return null
  }
  const text = readFileSyncUtf8(workspaceConfigPath)
  const included = new Set(
    [...text.matchAll(/^\s*-\s*'([^']+)'\s*$/gmu)]
      .map(match => match[1].replace(/\\/g, '/'))
      .filter(entry => !entry.startsWith('!') && !entry.includes('*'))
  )
  return included.size > 0 ? included : null
}

function readFileSyncUtf8(filePath) {
  return readFileSync(filePath, 'utf8')
}

async function loadWorkspaces() {
  const items = []
  for (const dirName of PACKAGE_DIRS) {
    const dir = path.join(ROOT, dirName)
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      const manifestPath = path.join(dir, entry.name, 'package.json')
      if (!existsSync(manifestPath)) {
        continue
      }
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      const dirPath = path.join(dir, entry.name)
      const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
      const manifestWorkspaceDeps = []
      for (const section of dependencySections) {
        for (const [target, version] of Object.entries(manifest[section] ?? {})) {
          if (typeof version === 'string' && version.startsWith('workspace:')) {
            manifestWorkspaceDeps.push({ section, target })
          }
        }
      }
      items.push({
        name: manifest.name ?? `${dirName}/${entry.name}`,
        dir: dirPath,
        relativeDir: path.relative(ROOT, dirPath).replace(/\\/g, '/'),
        activeWorkspace: ACTIVE_WORKSPACE_DIRS == null
          ? true
          : ACTIVE_WORKSPACE_DIRS.has(path.relative(ROOT, dirPath).replace(/\\/g, '/')),
        version: manifest.version ?? '',
        private: Boolean(manifest.private),
        packageType: dirName === 'apps' ? 'app' : 'package',
        typeField: manifest.type ?? '',
        dependencies: manifest.dependencies ?? {},
        devDependencies: manifest.devDependencies ?? {},
        peerDependencies: manifest.peerDependencies ?? {},
        optionalDependencies: manifest.optionalDependencies ?? {},
        manifestWorkspaceDeps,
        scripts: manifest.scripts ?? {},
        buildScript: manifest.scripts?.build ?? null,
        testScript: manifest.scripts?.test ?? null,
        runtimeEntryPoint: manifest.main ?? manifest.module ?? Object.values(manifest.bin ?? {})[0] ?? null,
        sourceImporters: [],
        directDependents: [],
        buildImporters: [],
        runtimeImporters: [],
        testImporters: [],
        productionReachable: false
      })
    }
  }
  return items
    .filter(item => item.activeWorkspace)
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function listRepoFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'dist-runner', '.nx', 'artifacts'].includes(entry.name)) {
        continue
      }
      files.push(...(await listRepoFiles(fullPath)))
      continue
    }
    files.push({
      fullPath,
      relativePath
    })
  }
  return files
}

async function scanRepoFiles(files, workspaces) {
  const workspaceNames = new Set(workspaces.map(workspace => workspace.name))
  const workspaceImporters = new Map()
  const manifestEdges = []
  const mlightcadMatches = []
  const playwrightMatches = []
  const i18nMatches = []

  for (const workspace of workspaces) {
    for (const [section, deps] of Object.entries({
      dependencies: workspace.dependencies,
      devDependencies: workspace.devDependencies,
      peerDependencies: workspace.peerDependencies,
      optionalDependencies: workspace.optionalDependencies
    })) {
      for (const [dependency, version] of Object.entries(deps)) {
        manifestEdges.push({
          from: workspace.name,
          to: dependency,
          edgeType: section,
          version
        })
      }
    }
  }

  for (const file of files) {
    const text = await readFile(file.fullPath, 'utf8').catch(() => null)
    if (text == null) {
      continue
    }
    const context = classifyFileContext(file.relativePath)
    const ownerWorkspace = owningWorkspace(file.fullPath, workspaces)
    const generatedOrHistorical =
      file.relativePath.startsWith('docs/minimization/') ||
      file.relativePath.startsWith('artifacts/minimization/') ||
      /(^|\/)lib\//u.test(file.relativePath)
    const specifiers = extractImportSpecifiers(text)
    for (const specifier of specifiers) {
      if (generatedOrHistorical) {
        continue
      }
      const workspaceTarget = resolveWorkspaceSpecifier(specifier, workspaceNames)
      if (!workspaceTarget || !ownerWorkspace) {
        continue
      }
      const record = {
        file: file.relativePath,
        specifier,
        context
      }
      if (!workspaceImporters.has(workspaceTarget)) {
        workspaceImporters.set(workspaceTarget, [])
      }
      workspaceImporters.get(workspaceTarget).push(record)
    }

    if (!generatedOrHistorical && /@mlightcad\/|MLightCAD|mlightcad/u.test(text)) {
      for (const match of extractScopedPackageMatches(text, /@mlightcad\/[A-Za-z0-9._/-]+/g)) {
        mlightcadMatches.push({
          file: file.relativePath,
          packageName: match,
          context,
          ownerWorkspace: ownerWorkspace?.name ?? null,
          importClauses: extractImportClauses(text, match)
        })
      }
    }

    if (!generatedOrHistorical && /(?:vue-i18n|useI18n|createI18n|i18n\.global|\$t\(|@intlify)/u.test(text)) {
      i18nMatches.push({
        file: file.relativePath,
        context,
        ownerWorkspace: ownerWorkspace?.name ?? null,
        text
      })
    }

    if (
      !generatedOrHistorical &&
      !file.relativePath.endsWith('package.json') &&
      /(?:playwright|chromium|page\.evaluate|browser\.newPage)/u.test(text)
    ) {
      playwrightMatches.push({
        file: file.relativePath,
        context,
        ownerWorkspace: ownerWorkspace?.name ?? null,
        lines: extractInterestingLines(
          text,
          /(playwright|chromium|page\.evaluate|browser\.newPage)/u
        )
      })
    }
  }

  return {
    workspaceImporters,
    manifestEdges,
    mlightcadMatches,
    playwrightMatches,
    i18nMatches
  }
}

function buildWorkspaceGraph(workspaces, scans) {
  const nodes = workspaces.map(workspace => ({
    id: workspace.name,
    path: workspace.relativeDir,
    type: workspace.packageType,
    private: workspace.private,
    productionReachable: workspace.productionReachable
  }))
  const edges = []
  for (const edge of scans.manifestEdges) {
    edges.push({
      from: edge.from,
      to: edge.to,
      kind: edge.edgeType === 'dependencies'
        ? 'runtime dependency'
        : edge.edgeType === 'devDependencies'
          ? 'development dependency'
          : edge.edgeType === 'peerDependencies'
            ? 'peer dependency'
            : 'optional dependency',
      evidence: edge.version
    })
  }
  for (const workspace of workspaces) {
    for (const importer of workspace.sourceImporters) {
      const owner = owningWorkspace(path.join(ROOT, importer.file), workspaces)
      if (!owner) {
        continue
      }
      edges.push({
        from: owner.name,
        to: workspace.name,
        kind:
          importer.context === 'runtime'
            ? 'source-code import'
            : importer.context === 'test'
              ? 'test-only dependency'
              : 'build-only dependency',
        evidence: importer.file
      })
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges
  }
}

function computeReachablePackages(workspaces, graph, roots) {
  const adjacency = new Map()
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, [])
    }
    adjacency.get(edge.from).push(edge)
  }
  const reachable = new Set()
  const queue = [...roots]
  while (queue.length > 0) {
    const current = queue.shift()
    if (reachable.has(current)) {
      continue
    }
    reachable.add(current)
    for (const edge of adjacency.get(current) ?? []) {
      if (
        edge.kind === 'runtime dependency' ||
        edge.kind === 'optional dependency' ||
        edge.kind === 'source-code import' ||
        edge.kind === 'build-only dependency'
      ) {
        queue.push(edge.to)
      }
    }
  }
  return reachable
}

async function analyzeI18n(i18nMatches) {
  const files = []
  const staticKeys = new Map()
  const dynamicPatterns = []
  const englishUiStrings = {}
  const localeFiles = await listLocaleFiles()
  const englishCatalog = await buildEnglishCatalog(localeFiles)

  for (const match of i18nMatches) {
    if (!isActiveRuntimeOrBuildSource(match.file)) {
      continue
    }
    const fileInfo = {
      file: match.file,
      context: match.context,
      ownerWorkspace: match.ownerWorkspace,
      translationKeys: [],
      dynamicKeys: []
    }
    for (const key of extractStaticTranslationKeys(match.text)) {
      fileInfo.translationKeys.push(key)
      staticKeys.set(key, englishCatalog[key] ?? null)
    }
    for (const pattern of extractDynamicTranslationPatterns(match.text)) {
      fileInfo.dynamicKeys.push(pattern)
      dynamicPatterns.push({
        file: match.file,
        pattern
      })
    }
    files.push(fileInfo)
  }

  for (const [key, value] of staticKeys.entries()) {
    englishUiStrings[key] = {
      english: value,
      resolved: value != null
    }
  }

  const unusedKeys = Object.keys(englishCatalog).filter(key => !staticKeys.has(key))

  return {
    files,
    localeFiles: localeFiles.map(item => item.relativePath),
    englishUiStrings,
    dynamicPatterns,
    unresolvedKeys: [...staticKeys.entries()].filter(([, value]) => value == null).map(([key]) => key),
    unusedKeys
  }
}

async function listLocaleFiles() {
  const result = []
  for (const file of await listRepoFiles(path.join(ROOT, 'packages'))) {
    if (
      /\/(?:locale|i18n)\/en\/.*\.(ts|js)$/u.test(file.relativePath) &&
      !/\.d\.ts$/u.test(file.relativePath)
    ) {
      result.push(file)
    }
  }
  return result
}

async function buildEnglishCatalog(localeFiles) {
  const catalog = {}
  for (const file of localeFiles) {
    const relativePath = path.relative(ROOT, file.fullPath).replace(/\\/g, '/')
    const source = await readFile(file.fullPath, 'utf8')
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022
      }
    }).outputText
    const tempDir = await mkdtemp(path.join(tmpdir(), 'cadflux-locale-'))
    const tempFile = path.join(tempDir, `${path.basename(file.fullPath)}.mjs`)
    await writeFile(tempFile, transpiled, 'utf8')
    try {
      const module = await import(pathToFileURL(tempFile).href)
      const value = module.default ?? module
      const namespace = path.basename(file.fullPath).replace(/\.(ts|js)$/u, '')
      flattenObject(value, namespace, catalog)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
    file.relativePath = relativePath
  }
  return catalog
}

function analyzeMlightcad(matches, workspaces) {
  const grouped = new Map()
  for (const match of matches) {
    if (!grouped.has(match.packageName)) {
      grouped.set(match.packageName, [])
    }
    grouped.get(match.packageName).push(match)
  }
  const packages = [...grouped.entries()]
    .map(([packageName, usages]) => ({
      packageName,
      importedBy: [...new Set(usages.map(item => item.file))].sort(),
      importedSymbols: [...new Set(usages.flatMap(item => item.importClauses))].sort(),
      contexts: [...new Set(usages.map(item => item.context))].sort(),
      usedBy: {
        web: usages.some(item => item.ownerWorkspace === '@cadflux/web' || item.file.startsWith('packages/renderer-webgl/')),
        server: usages.some(item => item.ownerWorkspace === '@cadflux/server'),
        cli: usages.some(item => item.ownerWorkspace === '@cadflux/cli')
      }
    }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName))

  const essential = packages.filter(item =>
    item.packageName.includes('data-model') ||
    item.packageName.includes('libredwg-converter') ||
    item.packageName.includes('mtext-renderer')
  )
  const replaceable = packages.filter(item =>
    item.packageName.includes('cad-pdf-plugin') ||
    item.packageName.includes('cad-svg-plugin') ||
    item.packageName.includes('ui-components') ||
    item.packageName.includes('ribbon') ||
    item.packageName.includes('mtext-input-box')
  )
  const removable = packages.filter(item =>
    item.packageName.includes('cad-agent-plugin') ||
    item.packageName.includes('cad-html-plugin')
  )

  return {
    packages,
    essential,
    replaceable,
    removable
  }
}

function analyzePlaywright(matches) {
  const callSites = matches
    .filter(match => isActiveRuntimeOrBuildSource(match.file))
    .map(match => ({
      file: match.file,
      context: match.context,
      ownerWorkspace: match.ownerWorkspace,
      purpose: inferPlaywrightPurpose(match.file),
      lines: match.lines
    }))
  return {
    callSites,
    dependencies: [...new Set(callSites.map(item => item.ownerWorkspace).filter(Boolean))].sort(),
    removedFromRuntime: callSites.length === 0
  }
}

function isActiveRuntimeOrBuildSource(relativePath) {
  return !(
    relativePath.startsWith('docs/minimization/') ||
    relativePath.startsWith('artifacts/minimization/') ||
    relativePath.startsWith('tools/minimization/') ||
    relativePath.endsWith('.test.ts') ||
    relativePath.endsWith('.test.js') ||
    /(^|\/)lib\//u.test(relativePath) ||
    relativePath === '.dockerignore' ||
    relativePath === '.gitignore' ||
    relativePath === 'pnpm-lock.yaml'
  )
}

function classifyPackages(workspaces, mlightcadAudit, playwrightAudit, i18nAudit) {
  const byName = new Map()
  for (const workspace of workspaces) {
    let classification = 'UNKNOWN'
    let evidence = []
    if (PRODUCTION_ROOTS.has(workspace.name)) {
      classification = 'KEEP_RUNTIME'
      evidence.push('Production root')
    } else if (workspace.productionReachable) {
      classification = 'KEEP_RUNTIME'
      evidence.push('Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli')
    } else if (workspace.testImporters.length > 0) {
      classification = 'KEEP_DEV'
      evidence.push('Referenced by tests')
    } else if (workspace.buildImporters.length > 0 || workspace.buildScript) {
      classification = 'KEEP_BUILD'
      evidence.push('Referenced by build/config scripts')
    } else {
      classification = 'DELETE_AFTER_TESTS'
      evidence.push('No production reachability detected')
    }

    if (['@cadflux/renderer-pdf', '@cadflux/renderer-svg'].includes(workspace.name)) {
      classification = 'KEEP_RUNTIME'
      evidence.push('Current production conversion uses direct Node-native rendering')
    }
    if (['@cadflux/renderer-webgl'].includes(workspace.name)) {
      classification = 'WRAP_FIRST'
      evidence.push('Web preview depends on wrapped MLightCAD viewer stack')
    }
    if (['@mlightcad/cad-pdf-plugin', '@mlightcad/cad-svg-plugin'].includes(workspace.name)) {
      classification = 'WRAP_FIRST'
      evidence.push('Direct MLightCAD runtime integration')
    }
    if (
      [
        '@mlightcad/cad-agent-plugin',
        '@mlightcad/cad-html-plugin',
        '@mlightcad/cad-html-exporter-cli',
        '@mlightcad/cad-viewer-example',
        '@mlightcad/cad-simple-viewer-example',
        '@mlightcad/examples'
      ].includes(workspace.name)
    ) {
      classification = 'REFERENCE_ONLY'
      evidence.push('Example/plugin/reference package outside CadFlux production roots')
    }

    byName.set(workspace.name, {
      classification,
      evidence: [...new Set(evidence)].sort()
    })
  }

  byName.set('playwright', {
    classification: 'DELETE_AFTER_TESTS',
    evidence: ['Removed from current production conversion path; only minimization and regression references remain']
  })
  byName.set('vue-i18n', {
    classification: 'DELETE_AFTER_TESTS',
    evidence: [
      `Active runtime/build references detected: ${i18nAudit.files.length}`,
      'Removed from current English-only UI path; historical references may remain in baseline artifacts'
    ]
  })
  byName.set('fastify', {
    classification: 'KEEP_RUNTIME',
    evidence: ['Primary server framework']
  })
  byName.set('better-sqlite3', {
    classification: 'KEEP_RUNTIME',
    evidence: ['Primary server database and queue storage']
  })
  byName.set('vite', {
    classification: 'KEEP_BUILD',
    evidence: ['Current web build tool']
  })
  byName.set('typescript', {
    classification: 'KEEP_BUILD',
    evidence: ['Current workspace build and analysis compiler']
  })
  return byName
}

function buildDeletionPlan(workspaces, classification) {
  const group = predicate => workspaces.filter(workspace => predicate(classification.get(workspace.name)?.classification ?? 'UNKNOWN'))
  return {
    lowRiskRemovals: group(value => value === 'REFERENCE_ONLY' || value === 'DELETE_AFTER_TESTS'),
    i18nRemoval: ['vue-i18n', '@intlify/eslint-plugin-vue-i18n'],
    mlightcadUiRemoval: workspaces.filter(workspace =>
      ['@mlightcad/cad-viewer', '@mlightcad/cad-simple-ui-plugin', '@mlightcad/cad-agent-plugin'].includes(workspace.name)
    ),
    playwrightRemoval: workspaces.filter(workspace =>
      ['@cadflux/renderer-pdf', '@cadflux/renderer-svg', '@cadflux/cli'].includes(workspace.name)
    ),
    toolingSimplification: []
  }
}

function renderWorkspaceInventoryMarkdown(workspaces, classification) {
  const lines = [
    '# Workspace inventory',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Package | Path | Type | Direct dependents | Runtime use | Build use | Test use | Current classification | Removal candidate | Replacement required | Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]
  for (const workspace of workspaces) {
    const entry = classification.get(workspace.name)
    lines.push(
      `| ${workspace.name} | ${workspace.relativeDir} | ${workspace.packageType} | ${escapeCell(workspace.directDependents.join('<br>'))} | ${workspace.runtimeImporters.length > 0 || workspace.productionReachable ? 'yes' : 'no'} | ${workspace.buildImporters.length > 0 || workspace.buildScript ? 'yes' : 'no'} | ${workspace.testImporters.length > 0 || workspace.testScript ? 'yes' : 'no'} | ${entry?.classification ?? 'UNKNOWN'} | ${['REFERENCE_ONLY', 'DELETE_AFTER_TESTS'].includes(entry?.classification ?? '') ? 'yes' : 'no'} | ${['WRAP_FIRST', 'REWRITE_FIRST'].includes(entry?.classification ?? '') ? 'yes' : 'no'} | ${escapeCell((entry?.evidence ?? []).join('; '))} |`
    )
  }
  return lines.join('\n')
}

function renderWorkspaceGraphMarkdown(graph) {
  const lines = [
    '# Workspace graph',
    '',
    `Nodes: ${graph.nodes.length}`,
    '',
    `Edges: ${graph.edges.length}`,
    '',
    '| From | To | Kind | Evidence |',
    '| --- | --- | --- | --- |'
  ]
  for (const edge of graph.edges.sort((a, b) => `${a.from}:${a.to}:${a.kind}`.localeCompare(`${b.from}:${b.to}:${b.kind}`))) {
    lines.push(`| ${edge.from} | ${edge.to} | ${edge.kind} | ${escapeCell(String(edge.evidence ?? ''))} |`)
  }
  return lines.join('\n')
}

function renderDotGraph(graph) {
  const lines = ['digraph cadflux_workspaces {', '  rankdir=LR;']
  for (const node of graph.nodes) {
    lines.push(`  "${node.id}" [label="${node.id}\\n${node.path}"];`)
  }
  for (const edge of graph.edges) {
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.kind}"];`)
  }
  lines.push('}')
  return lines.join('\n')
}

function renderMlightcadMarkdown(audit) {
  const lines = [
    '# MLightCAD usage audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Package | Imported by | Imported symbols | Runtime/build/test | Used by web/server/CLI | Can be wrapped | Can be rewritten | Can be deleted now | Replacement required |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]
  for (const item of audit.packages) {
    const canWrap = /(cad-pdf-plugin|cad-svg-plugin|data-model)/u.test(item.packageName)
    const canRewrite = /(cad-pdf-plugin|cad-svg-plugin|mtext-renderer|ui-components|ribbon)/u.test(item.packageName)
    const canDelete = /(cad-agent-plugin|cad-html-plugin)/u.test(item.packageName)
    lines.push(
      `| ${item.packageName} | ${escapeCell(item.importedBy.join('<br>'))} | ${escapeCell(item.importedSymbols.join('<br>'))} | ${item.contexts.join(', ')} | web=${item.usedBy.web}; server=${item.usedBy.server}; cli=${item.usedBy.cli} | ${canWrap ? 'yes' : 'no'} | ${canRewrite ? 'yes' : 'no'} | ${canDelete ? 'yes' : 'no'} | ${canWrap || canRewrite ? 'yes' : 'no'} |`
    )
  }
  lines.push('', '## A. Likely essential', '')
  for (const item of audit.essential) {
    lines.push(`- ${item.packageName}`)
  }
  lines.push('', '## B. Potentially replaceable', '')
  for (const item of audit.replaceable) {
    lines.push(`- ${item.packageName}`)
  }
  lines.push('', '## C. Likely removable', '')
  for (const item of audit.removable) {
    lines.push(`- ${item.packageName}`)
  }
  return lines.join('\n')
}

function renderPlaywrightMarkdown(audit) {
  const lines = [
    '# Playwright and Chromium usage audit',
    '',
    'Current conversion flow:',
    '',
    '```text',
    'Server worker',
    '→ child process',
    '→ direct Node renderer package',
    '→ PDF/SVG bytes',
    '```',
    '',
    `Active runtime/build call sites: ${audit.callSites.length}`,
    '',
    '| File | Purpose | Used by PDF or SVG | Browser-only API required | Input transport | Output transport | Runner assets | WASM dependencies | Replacement requirement |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]
  for (const item of audit.callSites) {
    const mode = item.file.includes('renderer-pdf') ? 'PDF' : item.file.includes('renderer-svg') ? 'SVG' : 'other'
    lines.push(
      `| ${item.file} | ${inferPlaywrightPurpose(item.file)} | ${mode} | ${item.lines.some(line => line.includes('page.evaluate') || line.includes('browser.newPage')) ? 'yes' : 'no'} | n/a | n/a | no | n/a | remove residual reference |`
    )
  }
  lines.push(
    '',
    'Current status:',
    '',
    '- Playwright and Chromium are no longer required by the active CadFlux server or CLI conversion path.',
    '- The active renderer path is direct Node-native PDF/SVG generation.',
    `- Runtime/build source references remaining: ${audit.callSites.length}.`
  )
  return lines.join('\n')
}

function renderI18nMarkdown(audit) {
  const lines = [
    '# vue-i18n usage audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Locale files detected: ${audit.localeFiles.length}`,
    '',
    '| File | Context | Static translation keys | Dynamic keys |',
    '| --- | --- | --- | --- |'
  ]
  for (const file of audit.files) {
    lines.push(
      `| ${file.file} | ${file.context} | ${escapeCell(file.translationKeys.join('<br>'))} | ${escapeCell(file.dynamicKeys.join('<br>'))} |`
    )
  }
  lines.push('', '## Validation summary', '')
  lines.push(`- Missing English values: ${audit.unresolvedKeys.length}`)
  lines.push(`- Unused English keys: ${audit.unusedKeys.length}`)
  lines.push(`- Dynamically constructed keys: ${audit.dynamicPatterns.length}`)
  return lines.join('\n')
}

function renderPackageClassificationMarkdown(workspaces, classification) {
  const lines = [
    '# Package classification',
    '',
    '| Package | Classification | Evidence |',
    '| --- | --- | --- |'
  ]
  for (const workspace of workspaces) {
    const entry = classification.get(workspace.name) ?? {
      classification: 'UNKNOWN',
      evidence: ['No classification evidence recorded']
    }
    lines.push(`| ${workspace.name} | ${entry.classification} | ${escapeCell(entry.evidence.join('; '))} |`)
  }
  for (const dependency of ['playwright', 'vue-i18n', 'fastify', 'better-sqlite3', 'vite', 'typescript']) {
    const entry = classification.get(dependency)
    if (!entry) {
      continue
    }
    lines.push(`| ${dependency} | ${entry.classification} | ${escapeCell(entry.evidence.join('; '))} |`)
  }
  return lines.join('\n')
}

function renderDeletionPlanMarkdown(plan) {
  const renderGroup = (title, items, replacement, risk) => {
    const names = items.map(item => typeof item === 'string' ? item : item.name)
    return [
      `## ${title}`,
      '',
      `- Files/packages affected: ${names.join(', ') || 'none detected'}`,
      '- Expected size reduction: baseline measurement required',
      `- Required replacement: ${replacement}`,
      '- Tests protecting behavior: test:minimization + existing server/build tests',
      `- Risk: ${risk}`,
      '- Rollback strategy: restore package from git and rerun baseline tests',
      ''
    ].join('\n')
  }
  const completedPlaywrightGroup = [
    '## Group 4 � Playwright removal',
    '',
    '- Status: completed on August 1, 2026',
    '- Files/packages affected: @cadflux/cli, @cadflux/renderer-pdf, @cadflux/renderer-svg, local bridge/runtime runner assets',
    '- Expected size reduction: requires regenerated minimization baseline',
    '- Required replacement: direct Node-native PDF/SVG renderer path',
    '- Tests protecting behavior: test:minimization + test:integration + build:cadflux',
    '- Risk: closed for active runtime path; residual documentation cleanup remains',
    '- Rollback strategy: restore package from git and rerun baseline tests',
    ''
  ].join('\n')
  return [
    '# Deletion plan',
    '',
    renderGroup('Group 1 — low-risk removals', plan.lowRiskRemovals, 'none or package-level removal only', 'low'),
    renderGroup('Group 2 — i18n removal', plan.i18nRemoval, 'static English strings / simple locale shim', 'medium'),
    renderGroup('Group 3 — MLightCAD UI/editor removal', plan.mlightcadUiRemoval, 'CadFlux-owned viewer wrappers/adapters', 'high'),
    completedPlaywrightGroup,
    renderGroup('Group 5 — workspace/tooling simplification', plan.toolingSimplification, 'replace or narrow root workflows', 'medium')
  ].join('\n')
}

function extractImportSpecifiers(text) {
  const regexes = [
    /\bimport\s+(?:[^'"`]+?\s+from\s+)?['"`]([^'"`]+)['"`]/gu,
    /\bexport\s+(?:[^'"`]+?\s+from\s+)?['"`]([^'"`]+)['"`]/gu,
    /\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)/gu,
    /\bimport\(\s*['"`]([^'"`]+)['"`]\s*\)/gu
  ]
  const values = new Set()
  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      values.add(match[1])
    }
  }
  return [...values]
}

function resolveWorkspaceSpecifier(specifier, workspaceNames) {
  if (workspaceNames.has(specifier)) {
    return specifier
  }
  for (const name of workspaceNames) {
    if (specifier.startsWith(`${name}/`)) {
      return name
    }
  }
  return null
}

function classifyFileContext(relativePath) {
  if (/(\.test\.|\.spec\.|__tests__|e2e\/tests\/)/u.test(relativePath)) {
    return 'test'
  }
  if (
    /(vite\.config|playwright\.config|jest\.config|project\.json|package\.json|tsconfig|scripts\/|tools\/|Dockerfile|\.github\/workflows\/)/u.test(relativePath)
  ) {
    return 'build'
  }
  return 'runtime'
}

function owningWorkspace(fullPath, workspaces) {
  const normalized = path.normalize(fullPath)
  return workspaces.find(workspace => normalized.startsWith(path.normalize(workspace.dir + path.sep))) ?? null
}

function extractScopedPackageMatches(text, regex) {
  return [...new Set([...text.matchAll(regex)].map(match => match[0].replace(/['"`]/g, '')))]
}

function extractImportClauses(text, packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`import\\s+([^;\\n]+?)\\s+from\\s+['"\`]${escaped}['"\`]`, 'gu')
  return [...new Set([...text.matchAll(regex)].map(match => match[1].trim()))]
}

function extractInterestingLines(text, matcher) {
  const lines = text.split(/\r?\n/u)
  return lines.filter(line => matcher.test(line)).map(line => line.trim())
}

function inferPlaywrightPurpose(file) {
  if (file.includes('renderer-pdf')) {
    return 'PDF browser bridge'
  }
  if (file.includes('renderer-svg')) {
    return 'SVG browser bridge'
  }
  if (file.includes('cad-html-exporter-cli')) {
    return 'HTML export runner'
  }
  if (file.includes('apps/cli')) {
    return 'CLI doctor/browser inspection'
  }
  return 'Playwright-related support'
}

function extractStaticTranslationKeys(text) {
  const keys = new Set()
  const regexes = [
    /\$t\(\s*['"`]([^'"`]+)['"`]\s*\)/gu,
    /\b(?:t|AcApI18n\.t|i18n\.global\.t)\(\s*['"`]([^'"`]+)['"`]\s*\)/gu
  ]
  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      keys.add(match[1])
    }
  }
  return [...keys].sort()
}

function extractDynamicTranslationPatterns(text) {
  const patterns = new Set()
  for (const match of text.matchAll(/\b(?:t|AcApI18n\.t|i18n\.global\.t)\(\s*([^)]*)\)/gu)) {
    const expr = match[1].trim()
    if (!/^['"`][^'"`]+['"`]$/u.test(expr)) {
      patterns.add(expr)
    }
  }
  return [...patterns].sort()
}

function flattenObject(value, prefix, target) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    target[prefix] = value
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    flattenObject(nested, `${prefix}.${key}`, target)
  }
}

function minWorkspace(workspace) {
  return {
    name: workspace.name,
    path: workspace.relativeDir,
    type: workspace.packageType
  }
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|')
}

async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}




