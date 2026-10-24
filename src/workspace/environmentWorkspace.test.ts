import { describe, expect, it, vi } from 'vitest'
import { createEnvironment } from '../domain/environments'
import type { PlaybackCoordinator } from '../domain/coordinator'
import type { EnvironmentPersistence } from '../domain/ports'
import { createEnvironmentWorkspace } from './environmentWorkspace'

function setup() {
  const first = createEnvironment('forest', 'Forest')
  const second = createEnvironment('cave', 'Cave')
  const persistence: EnvironmentPersistence = {
    load: () => [first, second],
    save: vi.fn(),
  }
  const playback = {
    start: vi.fn(),
    sync: vi.fn(),
    stop: vi.fn(),
    toggleCombat: vi.fn(),
    setEnvironmentVolume: vi.fn(),
    setSoundVolume: vi.fn(),
    playManualOneShot: vi.fn(),
    oneShotState: vi.fn(),
    scheduledOneShotCount: vi.fn(() => 0),
    subscribe: vi.fn(() => () => undefined),
    activeEnvironmentId: vi.fn(),
    dispose: vi.fn(),
  } as unknown as PlaybackCoordinator
  const workspace = createEnvironmentWorkspace({
    persistence,
    playback,
    createId: () => 'new-environment',
  })
  return { workspace, persistence, playback }
}

describe('Environment workspace', () => {
  it('keeps Environment edits and persistence behind one module', () => {
    const { workspace, persistence } = setup()

    workspace.renameEnvironment('forest', 'Misty Forest')

    expect(workspace.getSnapshot().environments[0].name).toBe('Misty Forest')
    expect(persistence.save).toHaveBeenLastCalledWith(
      workspace.getSnapshot().environments,
    )
  })

  it('coordinates active playback when editing and switching Environments', () => {
    const { workspace, playback } = setup()
    workspace.play('forest')
    workspace.setEnvironmentVolume('forest', 0.5)
    workspace.play('cave')

    expect(playback.setEnvironmentVolume).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'forest', volume: 0.5 }),
    )
    expect(playback.stop).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'forest' }),
    )
    expect(playback.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cave' }),
    )
  })

  it('provides generated IDs for new Environments', () => {
    const { workspace } = setup()

    expect(workspace.addEnvironment()).toMatchObject({
      id: 'new-environment',
      name: 'New Environment',
    })
  })
})
