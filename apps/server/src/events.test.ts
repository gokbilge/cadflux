// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { createJobEventBus } from './events'

describe('createJobEventBus', () => {
  test('publishes, replays history, and unsubscribes listeners', () => {
    const bus = createJobEventBus(3)
    const seen: string[] = []
    const unsubscribe = bus.subscribe('job-1', event => {
      seen.push(event.type)
    })

    const first = bus.publish('job-1', 'job.created', { value: 1 })
    const second = bus.publish('job-1', 'file.started', { value: 2 })
    const third = bus.publish('job-1', 'file.completed', { value: 3 })

    expect(seen).toEqual(['job.created', 'file.started', 'file.completed'])
    expect(bus.list('job-1').map(event => event.id)).toEqual([first.id, second.id, third.id])
    expect(bus.list('job-1', first.id).map(event => event.type)).toEqual([
      'file.started',
      'file.completed'
    ])

    unsubscribe()
    bus.publish('job-1', 'job.completed', {})
    expect(seen).toEqual(['job.created', 'file.started', 'file.completed'])
  })

  test('bounds history per job', () => {
    const bus = createJobEventBus(2)
    bus.publish('job-2', 'a', {})
    const second = bus.publish('job-2', 'b', {})
    const third = bus.publish('job-2', 'c', {})

    const history = bus.list('job-2')
    expect(history).toHaveLength(2)
    expect(history.map(event => event.id)).toEqual([second.id, third.id])
  })
})
