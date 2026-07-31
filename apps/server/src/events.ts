// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface JobEventRecord {
  id: string
  jobId: string
  type: string
  createdAt: string
  data: Record<string, unknown>
}

type JobListener = (event: JobEventRecord) => void

export interface JobEventBus {
  publish(jobId: string, type: string, data?: Record<string, unknown>): JobEventRecord
  list(jobId: string, afterId?: string): JobEventRecord[]
  subscribe(jobId: string, listener: JobListener): () => void
}

export function createJobEventBus(maxHistoryPerJob = 200): JobEventBus {
  const history = new Map<string, JobEventRecord[]>()
  const listeners = new Map<string, Set<JobListener>>()
  let nextId = 1

  return {
    publish(jobId, type, data = {}) {
      const event: JobEventRecord = {
        id: String(nextId++),
        jobId,
        type,
        createdAt: new Date().toISOString(),
        data
      }
      const jobHistory = history.get(jobId) ?? []
      jobHistory.push(event)
      if (jobHistory.length > maxHistoryPerJob) {
        jobHistory.splice(0, jobHistory.length - maxHistoryPerJob)
      }
      history.set(jobId, jobHistory)
      for (const listener of listeners.get(jobId) ?? []) {
        listener(event)
      }
      return event
    },
    list(jobId, afterId) {
      const jobHistory = history.get(jobId) ?? []
      if (!afterId) {
        return [...jobHistory]
      }
      const index = jobHistory.findIndex(event => event.id === afterId)
      return index >= 0 ? jobHistory.slice(index + 1) : [...jobHistory]
    },
    subscribe(jobId, listener) {
      const jobListeners = listeners.get(jobId) ?? new Set<JobListener>()
      jobListeners.add(listener)
      listeners.set(jobId, jobListeners)
      return () => {
        const current = listeners.get(jobId)
        if (!current) {
          return
        }
        current.delete(listener)
        if (current.size === 0) {
          listeners.delete(jobId)
        }
      }
    }
  }
}
