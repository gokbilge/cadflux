// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxConversionResult } from '@cadflux/core'

export interface BatchTask<T> {
  id: string
  run: () => Promise<T>
}

export interface BatchProgress<T> {
  taskId: string
  completed: number
  total: number
  result?: T
}

export class CadFluxBatchEngine<T = CadFluxConversionResult> {
  private paused = false
  private cancelled = false

  constructor(private readonly concurrency: number) {}

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  cancel() {
    this.cancelled = true
  }

  async run(
    tasks: BatchTask<T>[],
    onProgress?: (progress: BatchProgress<T>) => void
  ): Promise<T[]> {
    const pending = [...tasks]
    const results: T[] = []
    let completed = 0

    const worker = async () => {
      while (pending.length > 0 && !this.cancelled) {
        while (this.paused && !this.cancelled) {
          await delay(100)
        }
        const task = pending.shift()
        if (!task) {
          return
        }
        const result = await task.run()
        results.push(result)
        completed += 1
        onProgress?.({
          taskId: task.id,
          completed,
          total: tasks.length,
          result
        })
      }
    }

    const workerCount = Math.max(1, Math.min(this.concurrency, tasks.length))
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    return results
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
