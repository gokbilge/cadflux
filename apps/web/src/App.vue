<template>
  <div class="shell">
    <main v-if="authState.status === 'loading'" class="center-panel">
      <div class="card">
        <h1>CadFlux</h1>
        <p class="muted">Connecting to the CadFlux server…</p>
      </div>
    </main>

    <main v-else-if="authState.user == null" class="center-panel">
      <form class="card login-card" @submit.prevent="login">
        <h1>CadFlux</h1>
        <p class="muted">Sign in to the CadFlux server to manage conversion jobs and profiles.</p>

        <label class="field">
          <span>Username</span>
          <input v-model="loginForm.username" autocomplete="username" />
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="loginForm.password" type="password" autocomplete="current-password" />
        </label>

        <p v-if="authState.error" class="error-text">{{ authState.error }}</p>

        <button class="primary" :disabled="authState.status === 'submitting'">
          {{ authState.status === 'submitting' ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>

    <div v-else class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>CadFlux</h1>
          <p class="muted">Self-hosted DWG/DXF conversion platform</p>
        </div>

        <div class="session-panel">
          <div>{{ authState.user.username }}</div>
          <div class="muted">{{ authState.user.role }}</div>
        </div>

        <nav class="nav">
          <button class="nav-item" :class="{ active: activeScreen === 'jobs' }" @click="activeScreen = 'jobs'">
            Jobs
          </button>
          <button
            class="nav-item"
            :class="{ active: activeScreen === 'profiles' }"
            @click="activeScreen = 'profiles'"
          >
            Profiles
          </button>
          <button
            v-if="authState.user.role === 'admin'"
            class="nav-item"
            :class="{ active: activeScreen === 'users' }"
            @click="activeScreen = 'users'"
          >
            Users
          </button>
        </nav>

        <div class="actions">
          <button class="secondary" @click="refreshActiveScreen">Refresh</button>
          <button class="secondary" @click="logout">Sign out</button>
        </div>
      </aside>

      <section class="content">
        <header class="topbar">
          <div>
            <h2>{{ screenTitle }}</h2>
            <p class="muted">{{ screenSubtitle }}</p>
          </div>
          <p v-if="pageError" class="error-text">{{ pageError }}</p>
        </header>

        <section v-if="activeScreen === 'jobs'" class="panel-grid">
          <form class="card" @submit.prevent="createJob">
            <h3>New conversion job</h3>

            <label class="field">
              <span>Name</span>
              <input v-model="newJobForm.name" placeholder="Project package" />
            </label>

            <label class="field">
              <span>Profile</span>
              <select v-model="newJobForm.profileId">
                <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
                  {{ profile.name }}
                </option>
              </select>
            </label>

            <button class="primary" :disabled="jobsState.loading">Create draft job</button>

            <div class="divider"></div>

            <label class="field">
              <span>Select files</span>
              <input type="file" multiple accept=".dwg,.dxf" @change="onFileInputChange" />
            </label>

            <label class="field">
              <span>Select directory</span>
              <input type="file" multiple webkitdirectory directory @change="onDirectoryInputChange" />
            </label>

            <div v-if="pendingUploads.length > 0" class="detail-stack">
              <small class="muted">{{ pendingUploads.length }} file(s) queued for upload</small>
              <div class="list compact-list">
                <div v-for="entry in pendingUploads.slice(0, 8)" :key="entry.relativePath" class="list-item static-item">
                  <span>{{ entry.relativePath }}</span>
                  <small>{{ formatBytes(entry.file.size) }}</small>
                </div>
              </div>
              <button
                class="primary"
                type="button"
                :disabled="selectedJob == null || uploadState.running"
                @click="uploadPendingFiles"
              >
                {{
                  uploadState.running
                    ? `Uploading ${uploadState.completed}/${uploadState.total || pendingUploads.length}`
                    : selectedJob == null
                      ? 'Select a job first'
                      : 'Upload to selected job'
                }}
              </button>
            </div>
          </form>

          <div class="card large-card">
            <div class="section-header">
              <h3>Jobs</h3>
              <span class="muted">{{ jobs.length }}</span>
            </div>

            <div v-if="jobsState.loading" class="muted">Loading jobs…</div>

            <div v-else class="list">
              <button
                v-for="job in jobs"
                :key="job.id"
                class="list-item"
                :class="{ active: selectedJobId === job.id }"
                @click="selectJob(job.id)"
              >
                <span>{{ job.name }}</span>
                <small>{{ job.status }}</small>
                <small>{{ Math.round(job.progressPercent) }}%</small>
                <small>{{ formatTimestamp(job.createdAt) }}</small>
              </button>
            </div>
          </div>

          <div class="card large-card">
            <h3>Job details</h3>

            <div v-if="selectedJob == null" class="muted">Select a job to inspect or change its state.</div>

            <div v-else class="detail-stack">
              <div class="detail-grid">
                <small>ID: {{ selectedJob.id }}</small>
                <small>Status: {{ selectedJob.status }}</small>
                <small>Files: {{ selectedJob.totalFiles }}</small>
                <small>Completed: {{ selectedJob.completedFiles }}</small>
                <small>Warnings: {{ selectedJob.warningFiles }}</small>
                <small>Failures: {{ selectedJob.failedFiles }}</small>
              </div>

              <div class="detail-stack">
                <div class="section-header">
                  <h4>Uploaded files</h4>
                  <span class="muted">{{ jobFiles.length }}</span>
                </div>

                <div v-if="jobFilesState.loading" class="muted">Loading files…</div>
                <div v-else-if="jobFiles.length === 0" class="muted">No files uploaded yet.</div>
                <div v-else class="list compact-list">
                  <div v-for="file in jobFiles" :key="file.id" class="list-item static-item">
                    <span>{{ file.relativePath }}</span>
                    <small>{{ file.format }} • {{ file.status }} • {{ formatBytes(file.sizeBytes) }}</small>
                    <button class="danger small-button" @click="deleteJobFile(selectedJob.id, file.id)">Remove</button>
                  </div>
                </div>
              </div>

              <div class="detail-stack">
                <div class="section-header">
                  <h4>Artifacts</h4>
                  <span class="muted">{{ outputArtifacts.length }}</span>
                </div>

                <div v-if="artifactsState.loading" class="muted">Loading artifacts…</div>
                <div v-else-if="outputArtifacts.length === 0" class="muted">No output artifacts yet.</div>
                <div v-else class="list compact-list">
                  <a
                    v-for="artifact in outputArtifacts"
                    :key="artifact.id"
                    class="list-item static-item artifact-link"
                    :href="`/api/v1/artifacts/${artifact.id}/download`"
                  >
                    <span>{{ artifact.relativePath }}</span>
                    <small>{{ artifact.format }} • {{ artifact.fidelity }} • {{ formatBytes(artifact.sizeBytes) }}</small>
                  </a>
                </div>
              </div>

              <div class="detail-stack">
                <div class="section-header">
                  <h4>Reports</h4>
                  <div class="actions">
                    <span class="muted">{{ reportArtifacts.length }}</span>
                    <button class="secondary small-button" @click="generateReports(selectedJob.id)">Generate</button>
                  </div>
                </div>

                <div v-if="artifactsState.loading" class="muted">Loading reports…</div>
                <div v-else-if="reportArtifacts.length === 0" class="muted">No reports generated yet.</div>
                <div v-else class="list compact-list">
                  <a
                    v-for="artifact in reportArtifacts"
                    :key="artifact.id"
                    class="list-item static-item artifact-link"
                    :href="`/api/v1/artifacts/${artifact.id}/download`"
                  >
                    <span>{{ artifact.relativePath }}</span>
                    <small>{{ artifact.type }} • {{ formatBytes(artifact.sizeBytes) }}</small>
                  </a>
                </div>
              </div>

              <textarea :value="prettyJson(selectedJob.profileJson)" readonly class="json-box" />

              <div class="actions">
                <button class="secondary" @click="updateJobStatus(selectedJob.id, 'start')">Queue</button>
                <button class="secondary" @click="updateJobStatus(selectedJob.id, 'pause')">Pause</button>
                <button class="secondary" @click="updateJobStatus(selectedJob.id, 'resume')">Resume</button>
                <button class="secondary" @click="updateJobStatus(selectedJob.id, 'retry')">Retry</button>
                <button class="secondary" @click="updateJobStatus(selectedJob.id, 'cancel')">Cancel</button>
                <button class="danger" @click="deleteJob(selectedJob.id)">Delete</button>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="activeScreen === 'profiles'" class="panel-grid">
          <form class="card" @submit.prevent="createProfile">
            <h3>New profile</h3>

            <label class="field">
              <span>Name</span>
              <input v-model="newProfileForm.name" />
            </label>

            <label class="field">
              <span>Description</span>
              <input v-model="newProfileForm.description" />
            </label>

            <label class="field">
              <span>Profile JSON</span>
              <textarea v-model="newProfileForm.profileJson" class="json-box" />
            </label>

            <button class="primary" :disabled="profilesState.loading">Save profile</button>
          </form>

          <div class="card large-card">
            <div class="section-header">
              <h3>Profiles</h3>
              <span class="muted">{{ profiles.length }}</span>
            </div>

            <div v-if="profilesState.loading" class="muted">Loading profiles…</div>

            <div v-else class="list">
              <button
                v-for="profile in profiles"
                :key="profile.id"
                class="list-item"
                :class="{ active: selectedProfileId === profile.id }"
                @click="selectedProfileId = profile.id"
              >
                <span>{{ profile.name }}</span>
                <small>{{ profile.isSystem ? 'system' : 'user' }}</small>
                <small>{{ formatTimestamp(profile.updatedAt) }}</small>
              </button>
            </div>
          </div>

          <div class="card large-card">
            <h3>Profile details</h3>

            <div v-if="selectedProfile == null" class="muted">Select a profile to inspect its JSON.</div>

            <div v-else class="detail-stack">
              <div class="detail-grid">
                <small>ID: {{ selectedProfile.id }}</small>
                <small>{{ selectedProfile.description || 'No description' }}</small>
              </div>

              <textarea :value="prettyJson(selectedProfile.profileJson)" readonly class="json-box" />

              <button v-if="!selectedProfile.isSystem" class="danger" @click="deleteProfile(selectedProfile.id)">
                Delete profile
              </button>
            </div>
          </div>
        </section>

        <section v-else class="panel-grid">
          <form class="card" @submit.prevent="createUser">
            <h3>Create user</h3>

            <label class="field">
              <span>Username</span>
              <input v-model="newUserForm.username" />
            </label>

            <label class="field">
              <span>Password</span>
              <input v-model="newUserForm.password" type="password" />
            </label>

            <label class="field">
              <span>Role</span>
              <select v-model="newUserForm.role">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <button class="primary" :disabled="usersState.loading">Create user</button>
          </form>

          <div class="card large-card">
            <div class="section-header">
              <h3>Users</h3>
              <span class="muted">{{ users.length }}</span>
            </div>

            <div v-if="usersState.loading" class="muted">Loading users…</div>

            <div v-else class="list">
              <div v-for="user in users" :key="user.id" class="user-row">
                <div>
                  <div>{{ user.username }}</div>
                  <small class="muted">{{ user.role }}</small>
                </div>
                <div class="actions">
                  <button class="secondary" @click="toggleUserActive(user)">
                    {{ user.isActive ? 'Disable' : 'Enable' }}
                  </button>
                  <button class="secondary" @click="toggleUserRole(user)">
                    Make {{ user.role === 'admin' ? 'user' : 'admin' }}
                  </button>
                  <button class="danger" :disabled="user.id === authState.user.id" @click="deleteUser(user.id)">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import type {
  AuthResponse,
  JobDto,
  JobFileDto,
  JobFileListResponse,
  JobListResponse,
  ProfileDto,
  ProfileListResponse,
  UserDto,
  UserListResponse
} from '@cadflux/contracts'

type Screen = 'jobs' | 'profiles' | 'users'

interface JobArtifactDto {
  id: string
  jobId: string
  jobFileId?: string
  type: string
  format: string
  relativePath: string
  sizeBytes: number
  checksum: string
  mimeType: string
  fidelity: string
  createdAt: string
}

const authState = reactive({
  status: 'loading' as 'loading' | 'idle' | 'submitting',
  user: null as UserDto | null,
  csrfToken: '',
  error: ''
})

const activeScreen = ref<Screen>('jobs')
const pageError = ref('')

const jobsState = reactive({ loading: false })
const jobFilesState = reactive({ loading: false })
const artifactsState = reactive({ loading: false })
const profilesState = reactive({ loading: false })
const usersState = reactive({ loading: false })
const uploadState = reactive({ running: false, completed: 0, total: 0 })

const jobs = ref<JobDto[]>([])
const jobFiles = ref<JobFileDto[]>([])
const jobArtifacts = ref<JobArtifactDto[]>([])
const profiles = ref<ProfileDto[]>([])
const users = ref<UserDto[]>([])
const pendingUploads = ref<Array<{ file: File; relativePath: string }>>([])

const selectedJobId = ref<string | null>(null)
const selectedProfileId = ref<string | null>(null)
const jobEvents = ref<EventSource | null>(null)

const loginForm = reactive({ username: '', password: '' })
const newJobForm = reactive({ name: '', profileId: '' })
const newProfileForm = reactive({
  name: '',
  description: '',
  profileJson: JSON.stringify(
    {
      id: 'custom',
      label: 'Custom',
      paper: 'A4',
      orientation: 'auto',
      scale: 'fit',
      color: 'color',
      formats: ['pdf']
    },
    null,
    2
  )
})
const newUserForm = reactive({
  username: '',
  password: '',
  role: 'user' as 'admin' | 'user'
})

const selectedJob = computed(() => jobs.value.find(job => job.id === selectedJobId.value) ?? null)
const selectedProfile = computed(
  () => profiles.value.find(profile => profile.id === selectedProfileId.value) ?? null
)
const outputArtifacts = computed(() =>
  jobArtifacts.value.filter(artifact => artifact.type === 'pdf' || artifact.type === 'svg')
)
const reportArtifacts = computed(() =>
  jobArtifacts.value.filter(artifact => ['json_report', 'csv_report', 'html_report', 'manifest', 'zip'].includes(artifact.type))
)

const screenTitle = computed(() => (activeScreen.value === 'jobs' ? 'Jobs' : activeScreen.value === 'profiles' ? 'Profiles' : 'Users'))
const screenSubtitle = computed(() =>
  activeScreen.value === 'jobs'
    ? 'Create draft jobs and control conversion state.'
    : activeScreen.value === 'profiles'
      ? 'Inspect system presets and maintain personal plot profiles.'
      : 'Admin-only user management.'
)

onMounted(async () => {
  await fetchSession()
  if (authState.user) {
    await refreshAll()
    connectJobEvents()
  }
})

onBeforeUnmount(() => {
  disconnectJobEvents()
})

async function fetchSession() {
  try {
    const response = await fetch('/api/v1/auth/me', { credentials: 'include' })
    if (!response.ok) {
      authState.status = 'idle'
      authState.user = null
      authState.csrfToken = ''
      return
    }
    const payload = (await response.json()) as AuthResponse
    authState.user = payload.user
    authState.csrfToken = payload.csrfToken
    authState.status = 'idle'
  } catch {
    authState.status = 'idle'
    authState.error = 'Could not reach the CadFlux server.'
  }
}

async function login() {
  authState.error = ''
  authState.status = 'submitting'
  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(loginForm)
    })
    if (!response.ok) {
      authState.error = 'Invalid credentials.'
      authState.status = 'idle'
      return
    }
    const payload = (await response.json()) as AuthResponse
    authState.user = payload.user
    authState.csrfToken = payload.csrfToken
    authState.status = 'idle'
    loginForm.password = ''
    await refreshAll()
    connectJobEvents()
  } catch {
    authState.error = 'Login failed.'
    authState.status = 'idle'
  }
}

async function logout() {
  await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  disconnectJobEvents()
  authState.user = null
  authState.csrfToken = ''
  jobs.value = []
  jobFiles.value = []
  jobArtifacts.value = []
  profiles.value = []
  users.value = []
}

async function refreshActiveScreen() {
  pageError.value = ''
  if (activeScreen.value === 'jobs') {
    await loadJobs()
  } else if (activeScreen.value === 'profiles') {
    await loadProfiles()
  } else {
    await loadUsers()
  }
}

async function refreshAll() {
  await Promise.all([loadJobs(), loadProfiles(), authState.user?.role === 'admin' ? loadUsers() : Promise.resolve()])
}

async function loadJobs() {
  jobsState.loading = true
  try {
    const payload = (await apiFetch('/api/v1/jobs')) as JobListResponse
    jobs.value = payload.jobs
    if (!selectedJobId.value) {
      selectedJobId.value = jobs.value[0]?.id ?? null
    }
    if (selectedJobId.value && !jobs.value.some(job => job.id === selectedJobId.value)) {
      selectedJobId.value = jobs.value[0]?.id ?? null
    }
    await Promise.all([loadJobFilesForSelectedJob(), loadArtifactsForSelectedJob()])
    connectJobEvents()
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    jobsState.loading = false
  }
}

async function loadProfiles() {
  profilesState.loading = true
  try {
    const payload = (await apiFetch('/api/v1/profiles')) as ProfileListResponse
    profiles.value = payload.profiles
    if (!newJobForm.profileId) {
      newJobForm.profileId = profiles.value[0]?.id ?? ''
    }
    if (!selectedProfileId.value) {
      selectedProfileId.value = profiles.value[0]?.id ?? null
    }
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    profilesState.loading = false
  }
}

async function loadUsers() {
  if (authState.user?.role !== 'admin') {
    return
  }
  usersState.loading = true
  try {
    const payload = (await apiFetch('/api/v1/admin/users')) as UserListResponse
    users.value = payload.users
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    usersState.loading = false
  }
}

async function createJob() {
  const profile = profiles.value.find(item => item.id === newJobForm.profileId)
  if (!profile) {
    pageError.value = 'Select a profile first.'
    return
  }
  try {
    await apiFetch('/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify({
        name: newJobForm.name.trim() || 'Untitled job',
        profileJson: profile.profileJson
      })
    })
    newJobForm.name = ''
    await loadJobs()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function updateJobStatus(jobId: string, action: 'start' | 'pause' | 'resume' | 'cancel' | 'retry') {
  try {
    await apiFetch(`/api/v1/jobs/${jobId}/${action}`, { method: 'POST' })
    await loadJobs()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function deleteJob(jobId: string) {
  try {
    await apiFetch(`/api/v1/jobs/${jobId}`, { method: 'DELETE' })
    if (selectedJobId.value === jobId) {
      disconnectJobEvents()
      selectedJobId.value = null
      jobFiles.value = []
      jobArtifacts.value = []
    }
    await loadJobs()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function generateReports(jobId: string) {
  try {
    await apiFetch(`/api/v1/jobs/${jobId}/reports`, { method: 'POST' })
    await loadArtifacts(jobId)
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function createProfile() {
  try {
    await apiFetch('/api/v1/profiles', { method: 'POST', body: JSON.stringify(newProfileForm) })
    newProfileForm.name = ''
    newProfileForm.description = ''
    await loadProfiles()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function deleteProfile(profileId: string) {
  try {
    await apiFetch(`/api/v1/profiles/${profileId}`, { method: 'DELETE' })
    if (selectedProfileId.value === profileId) {
      selectedProfileId.value = null
    }
    await loadProfiles()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function createUser() {
  try {
    await apiFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(newUserForm) })
    newUserForm.username = ''
    newUserForm.password = ''
    newUserForm.role = 'user'
    await loadUsers()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function toggleUserActive(user: UserDto) {
  try {
    await apiFetch(`/api/v1/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !user.isActive })
    })
    await loadUsers()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function toggleUserRole(user: UserDto) {
  try {
    await apiFetch(`/api/v1/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: user.role === 'admin' ? 'user' : 'admin' })
    })
    await loadUsers()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

async function deleteUser(userId: string) {
  try {
    await apiFetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' })
    await loadUsers()
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

function selectJob(jobId: string) {
  selectedJobId.value = jobId
  void Promise.all([loadJobFiles(jobId), loadArtifacts(jobId)])
  connectJobEvents()
}

async function loadJobFilesForSelectedJob() {
  if (!selectedJobId.value) {
    jobFiles.value = []
    return
  }
  await loadJobFiles(selectedJobId.value)
}

async function loadJobFiles(jobId: string) {
  jobFilesState.loading = true
  try {
    const payload = (await apiFetch(`/api/v1/jobs/${jobId}/files`)) as JobFileListResponse
    if (selectedJobId.value === jobId) {
      jobFiles.value = payload.files
    }
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    jobFilesState.loading = false
  }
}

async function loadArtifactsForSelectedJob() {
  if (!selectedJobId.value) {
    jobArtifacts.value = []
    return
  }
  await loadArtifacts(selectedJobId.value)
}

async function loadArtifacts(jobId: string) {
  artifactsState.loading = true
  try {
    const payload = (await apiFetch(`/api/v1/jobs/${jobId}/artifacts`)) as { artifacts: JobArtifactDto[] }
    if (selectedJobId.value === jobId) {
      jobArtifacts.value = payload.artifacts
    }
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    artifactsState.loading = false
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  appendPendingFiles(Array.from(input.files ?? []))
  input.value = ''
}

function onDirectoryInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  appendPendingFiles(Array.from(input.files ?? []))
  input.value = ''
}

function appendPendingFiles(files: File[]) {
  const nextEntries = files
    .filter(file => /\.(dwg|dxf)$/i.test(file.name))
    .map(file => ({ file, relativePath: getRelativePath(file) }))
  const byPath = new Map(pendingUploads.value.map(entry => [entry.relativePath, entry]))
  for (const entry of nextEntries) {
    byPath.set(entry.relativePath, entry)
  }
  pendingUploads.value = Array.from(byPath.values()).sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

async function uploadPendingFiles() {
  if (!selectedJobId.value) {
    pageError.value = 'Select a job before uploading files.'
    return
  }
  if (pendingUploads.value.length === 0) {
    return
  }
  uploadState.running = true
  uploadState.completed = 0
  uploadState.total = pendingUploads.value.length
  pageError.value = ''
  try {
    for (const entry of pendingUploads.value) {
      const formData = new FormData()
      formData.append('relativePath', entry.relativePath)
      formData.append('file', entry.file, entry.file.name)
      await apiUpload(`/api/v1/jobs/${selectedJobId.value}/files`, formData)
      uploadState.completed += 1
    }
    pendingUploads.value = []
    await loadJobs()
    await Promise.all([loadJobFilesForSelectedJob(), loadArtifactsForSelectedJob()])
  } catch (error) {
    pageError.value = toMessage(error)
  } finally {
    uploadState.running = false
  }
}

async function deleteJobFile(jobId: string, fileId: string) {
  try {
    await apiFetch(`/api/v1/jobs/${jobId}/files/${fileId}`, { method: 'DELETE' })
    await Promise.all([loadJobs(), loadJobFiles(jobId), loadArtifacts(jobId)])
  } catch (error) {
    pageError.value = toMessage(error)
  }
}

function connectJobEvents() {
  disconnectJobEvents()
  if (!selectedJobId.value || authState.user == null) {
    return
  }
  const source = new EventSource(`/api/v1/jobs/${selectedJobId.value}/events`, { withCredentials: true })
  const refresh = () => {
    if (!selectedJobId.value) {
      return
    }
    void Promise.all([loadJobs(), loadJobFilesForSelectedJob(), loadArtifactsForSelectedJob()])
  }
  for (const eventName of [
    'job.queued',
    'job.started',
    'job.progress',
    'job.paused',
    'job.resumed',
    'job.cancel.requested',
    'job.cancelled',
    'job.completed',
    'job.failed',
    'file.started',
    'file.progress',
    'file.warning',
    'file.completed',
    'file.failed',
    'artifact.created'
  ]) {
    source.addEventListener(eventName, refresh)
  }
  source.onerror = () => {
    // EventSource will reconnect automatically.
  }
  jobEvents.value = source
}

function disconnectJobEvents() {
  if (jobEvents.value) {
    jobEvents.value.close()
    jobEvents.value = null
  }
}

async function apiFetch(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': authState.csrfToken,
      ...(init.headers ?? {})
    },
    credentials: 'include'
  })
  if (!response.ok) {
    const payload = (await safeJson(response)) as { error?: { message?: string } } | undefined
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`)
  }
  return safeJson(response)
}

async function apiUpload(input: string, body: FormData) {
  const response = await fetch(input, {
    method: 'POST',
    body,
    headers: {
      'X-CSRF-Token': authState.csrfToken
    },
    credentials: 'include'
  })
  if (!response.ok) {
    const payload = (await safeJson(response)) as { error?: { message?: string } } | undefined
    throw new Error(payload?.error?.message ?? `Upload failed with ${response.status}`)
  }
  return safeJson(response)
}

async function safeJson(response: Response) {
  const text = await response.text()
  return text.length > 0 ? JSON.parse(text) : {}
}

function prettyJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString()
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function getRelativePath(file: File) {
  const candidate = 'webkitRelativePath' in file ? String(file.webkitRelativePath || '') : ''
  return candidate.trim().length > 0 ? candidate : file.name
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<style scoped>
.shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #f4f0e8 0%, #e5ddd2 100%);
  color: #1f2a26;
}

.center-panel {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  padding: 24px;
  border-right: 1px solid rgba(31, 42, 38, 0.1);
  background: rgba(255, 251, 243, 0.94);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.topbar h2,
.brand h1,
.card h3,
.login-card h1 {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
}

.panel-grid {
  display: grid;
  grid-template-columns: 320px 1fr 1fr;
  gap: 16px;
}

.card {
  background: rgba(255, 255, 255, 0.86);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid rgba(31, 42, 38, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.large-card {
  min-height: 320px;
}

.divider {
  height: 1px;
  background: rgba(31, 42, 38, 0.08);
}

.login-card {
  width: min(420px, 100%);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

input,
select,
textarea,
button {
  font: inherit;
}

input,
select,
textarea {
  border-radius: 14px;
  border: 1px solid rgba(31, 42, 38, 0.14);
  padding: 10px 12px;
  background: #fff;
}

button {
  border-radius: 999px;
  border: 1px solid rgba(31, 42, 38, 0.12);
  padding: 10px 16px;
}

.primary {
  background: #1f6a53;
  color: #fff;
}

.secondary {
  background: #fff;
  color: #1f2a26;
}

.danger {
  background: #8b2f2f;
  color: #fff;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  text-align: left;
  background: #fff;
}

.nav-item.active {
  background: #1f6a53;
  color: #fff;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item,
.user-row {
  border: 1px solid rgba(31, 42, 38, 0.1);
  border-radius: 14px;
  padding: 12px;
  background: #fff;
}

.list-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
}

.list-item.active {
  border-color: #1f6a53;
  box-shadow: 0 0 0 2px rgba(31, 106, 83, 0.12);
}

.static-item {
  width: 100%;
}

.compact-list {
  max-height: 240px;
  overflow: auto;
}

.small-button {
  padding: 6px 10px;
  border-radius: 10px;
}

.user-row,
.section-header,
.detail-grid {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.detail-grid {
  flex-wrap: wrap;
}

.detail-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.json-box {
  min-height: 220px;
  font-family: Consolas, 'Courier New', monospace;
  resize: vertical;
}

.artifact-link {
  color: inherit;
  text-decoration: none;
}

.muted {
  color: rgba(31, 42, 38, 0.68);
}

.error-text {
  color: #8b2f2f;
}

@media (max-width: 1200px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
}
</style>
