import { describe, expect, it, vi } from 'vitest'
import { createPlaybackCoordinator } from './coordinator'
import { fakeClock } from './ports'
import type { Environment, Sound } from './playback'

const loop: Sound = {
  id: 'rain',
  name: 'Rain',
  kind: 'loop',
  placement: 'ambiance',
  volume: 0.5,
  source: { urls: ['rain.mp3'] },
}
const environment: Environment = {
  id: 'forest',
  name: 'Forest',
  volume: 0.8,
  sounds: [loop],
  playing: false,
  combatMode: false,
  expanded: true,
  icon: null,
  iconColor: null,
}

function audio() {
  return {
    load: vi.fn(),
    playLoop: vi.fn(),
    playOneShot: vi.fn(),
    playManualOneShot: vi.fn(),
    setVolume: vi.fn(),
    stop: vi.fn(),
    unload: vi.fn(),
    onError: vi.fn(() => () => undefined),
  }
}

describe('playback coordinator', () => {
  it('loads a loop only when an Environment starts and fades it at the effective volume', () => {
    const port = audio()
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
    })

    expect(port.load).not.toHaveBeenCalled()
    coordinator.start(environment)

    expect(port.load).toHaveBeenCalledWith(loop)
    expect(port.playLoop).toHaveBeenCalledWith(loop, 0.4, 2000)
  })

  it('stops loops with a two-second fade and unloads them', () => {
    const port = audio()
    const clock = fakeClock()
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    coordinator.start(environment)
    coordinator.stop(environment)

    expect(port.stop).toHaveBeenCalledWith('rain', 2000)
    expect(port.unload).not.toHaveBeenCalled()
    clock.advance(2_000)
    expect(port.unload).toHaveBeenCalledWith('rain')
    expect(coordinator.activeEnvironmentId()).toBeUndefined()
  })

  it('schedules one-shots and keeps manual playback independent', () => {
    const clock = fakeClock()
    const port = audio()
    const sound: Sound = {
      id: 'thunder',
      kind: 'one-shot',
      placement: 'ambiance',
      volume: 1,
      variations: ['thunder.mp3'],
      minIntervalSeconds: 2,
      maxIntervalSeconds: 2,
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    const scene = { ...environment, sounds: [sound] }
    coordinator.start(scene)
    expect(port.playOneShot).not.toHaveBeenCalled()
    clock.advance(2_000)
    expect(port.playOneShot).toHaveBeenCalledWith(sound, 'thunder.mp3', 0.8)
    coordinator.stop(scene)
    coordinator.playManualOneShot(scene, sound)
    expect(port.playManualOneShot).toHaveBeenCalledWith(
      sound,
      'thunder.mp3',
      0.8,
    )
  })
})
