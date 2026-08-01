// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { openAsBlob } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const tempRoot = await mkdtemp(path.join(tmpdir(), 'cadflux-server-test-'))
const dataDir = path.join(tempRoot, 'data')
const databasePath = path.join(dataDir, 'database', 'cadflux.sqlite')
const fixturePath = path.resolve('fixtures/minimization/minimal-line.dxf')
const port = 18080 + Math.floor(Math.random() * 1000)
const baseUrl = `http://127.0.0.1:${port}`

const server = spawn(
  process.execPath,
  ['apps/server/dist/apps/server/src/index.js', 'serve'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CADFLUX_HOST: '127.0.0.1',
      CADFLUX_PORT: String(port),
      CADFLUX_BASE_URL: baseUrl,
      CADFLUX_DATA_DIR: dataDir,
      CADFLUX_DATABASE_PATH: databasePath,
      CADFLUX_SESSION_SECRET: 'integration-test-session-secret-1234567890',
      CADFLUX_ADMIN_USERNAME: 'admin',
      CADFLUX_ADMIN_PASSWORD: 'ChangeThisPassword123!',
      CADFLUX_WORKER_CONCURRENCY: '1',
      CADFLUX_CONVERSION_TIMEOUT_MS: '300000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
)

let serverOutput = ''
server.stdout.on('data', chunk => {
  serverOutput += chunk.toString()
})
server.stderr.on('data', chunk => {
  serverOutput += chunk.toString()
})

try {
  await waitForReady(baseUrl)

  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'ChangeThisPassword123!'
    })
  })
  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`)
  }
  const loginPayload = await loginResponse.json()
  const cookies = cookiesFromResponse(loginResponse)
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')

  const profiles = await authFetchJson(`${baseUrl}/api/v1/profiles`, cookieHeader, loginPayload.csrfToken)
  const profile = profiles.profiles[0]
  if (!profile) {
    throw new Error('No profile available for integration test.')
  }

  const createJob = await authFetchJson(`${baseUrl}/api/v1/jobs`, cookieHeader, loginPayload.csrfToken, {
    method: 'POST',
    body: JSON.stringify({
      name: 'integration-test-job',
      profileJson: profile.profileJson
    })
  })
  const jobId = createJob.job.id

  const form = new FormData()
  form.append('relativePath', 'minimal-line.dxf')
  form.append(
    'file',
    await openAsBlob(fixturePath, { type: 'application/octet-stream' }),
    'minimal-line.dxf'
  )
  const uploadResponse = await fetch(`${baseUrl}/api/v1/jobs/${jobId}/files`, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      'X-CSRF-Token': loginPayload.csrfToken
    },
    body: form
  })
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`)
  }

  await authFetchJson(`${baseUrl}/api/v1/jobs/${jobId}/start`, cookieHeader, loginPayload.csrfToken, {
    method: 'POST'
  })

  const terminalJob = await waitForTerminalJob(baseUrl, jobId, cookieHeader)
  if (!['completed', 'completed_with_warnings'].includes(terminalJob.status)) {
    throw new Error(`Job ended in unexpected status: ${terminalJob.status}`)
  }

  const artifactsPayload = await authFetchJson(`${baseUrl}/api/v1/jobs/${jobId}/artifacts`, cookieHeader, loginPayload.csrfToken)
  const pdfArtifact = artifactsPayload.artifacts.find(artifact => artifact.format === 'pdf')
  if (!pdfArtifact) {
    throw new Error('PDF artifact was not generated.')
  }

  const pdfResponse = await fetch(`${baseUrl}/api/v1/artifacts/${pdfArtifact.id}/download`, {
    headers: {
      Cookie: cookieHeader
    }
  })
  if (!pdfResponse.ok) {
    throw new Error(`PDF download failed: ${pdfResponse.status}`)
  }
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer())
  if (!pdfBytes.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error('Downloaded artifact is not a PDF.')
  }

  await authFetchJson(`${baseUrl}/api/v1/jobs/${jobId}/reports`, cookieHeader, loginPayload.csrfToken, {
    method: 'POST'
  })

  const reportPayload = await authFetchJson(`${baseUrl}/api/v1/jobs/${jobId}/reports`, cookieHeader, loginPayload.csrfToken)
  const zipArtifact = reportPayload.artifacts.find(artifact => artifact.type === 'zip')
  if (!zipArtifact) {
    throw new Error('ZIP report artifact was not generated.')
  }

  await writeFile(path.join(tempRoot, 'result.pdf'), pdfBytes)
  console.log(JSON.stringify({
    status: 'ok',
    jobId,
    pdfArtifactId: pdfArtifact.id,
    zipArtifactId: zipArtifact.id,
    tempRoot
  }, null, 2))
} finally {
  server.kill()
  await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
}

async function waitForReady(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health/ready`)
      if (response.ok) {
        return
      }
    } catch {
      // wait
    }
    await delay(1000)
  }
  throw new Error(`Server did not become ready.\n${serverOutput}`)
}

async function waitForTerminalJob(baseUrl, jobId, cookieHeader) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    let payload
    try {
      payload = await fetch(`${baseUrl}/api/v1/jobs/${jobId}`, {
        headers: {
          Cookie: cookieHeader
        }
      }).then(response => response.json())
    } catch {
      await delay(1000)
      continue
    }
    const status = payload.job.status
    if (['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status)) {
      return payload.job
    }
    await delay(1000)
  }
  throw new Error(`Job did not finish in time.\n${serverOutput}`)
}

async function authFetchJson(url, cookieHeader, csrfToken, init = {}) {
  const headers = {
    Cookie: cookieHeader,
    'X-CSRF-Token': csrfToken,
    ...(init.headers ?? {})
  }
  if (init.body && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(url, {
    ...init,
    headers
  })
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

function cookiesFromResponse(response) {
  const headers = response.headers.getSetCookie?.() ?? []
  const cookies = {}
  for (const header of headers) {
    const [pair] = header.split(';')
    const index = pair.indexOf('=')
    if (index <= 0) {
      continue
    }
    cookies[pair.slice(0, index)] = pair.slice(index + 1)
  }
  return cookies
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
