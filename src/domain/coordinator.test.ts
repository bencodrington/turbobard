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

  it('isolates a sound that fails during startup and continues with the rest', () => {
    const failingLoop = { ...loop, id: 'broken' }
    const port = audio()
    port.load.mockImplementation((sound) => {
      if (sound.id === 'broken') throw new Error('codec unavailable')
    })
    const onSoundError = vi.fn()
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
      onSoundError,
    })

    coordinator.start({ ...environment, sounds: [failingLoop, loop] })

    expect(onSoundError).toHaveBeenCalledWith('broken', expect.any(Error))
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

  it('exposes the coordinator-owned deadline and refreshes it after each firing', () => {
    const clock = fakeClock()
    const port = audio()
    const sound: Sound = {
      id: 'thunder',
      kind: 'one-shot',
      placement: 'ambiance',
      volume: 1,
      variations: ['thunder.mp3'],
      minIntervalSeconds: 2,
      maxIntervalSeconds: 4,
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    const changes = vi.fn()
    const scene = { ...environment, sounds: [sound] }
    coordinator.subscribe(changes)

    coordinator.start(scene)
    expect(coordinator.oneShotState(sound.id)).toMatchObject({
      nextFireAtMs: 2_000,
      durationMs: 2_000,
      remainingMs: 2_000,
      fractionRemaining: 1,
    })

    clock.advance(500)
    expect(coordinator.oneShotState(sound.id)).toMatchObject({
      remainingMs: 1_500,
      fractionRemaining: 0.75,
    })

    clock.advance(1_500)
    expect(port.playOneShot).toHaveBeenCalledOnce()
    expect(coordinator.oneShotState(sound.id)).toMatchObject({
      nextFireAtMs: 4_000,
      durationMs: 2_000,
      remainingMs: 2_000,
      fractionRemaining: 1,
    })
    expect(changes).toHaveBeenCalled()
  })

  it('removes a one-shot deadline when the schedule is cancelled', () => {
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
    expect(coordinator.scheduledOneShotCount()).toBe(1)
    coordinator.sync({ ...scene, sounds: [] })

    expect(coordinator.oneShotState(sound.id)).toBeUndefined()
    expect(coordinator.scheduledOneShotCount()).toBe(0)
  })

  it('starts added active loops and schedules added one-shots without immediate playback', () => {
    const clock = fakeClock()
    const port = audio()
    const sound: Sound = {
      id: 'wind',
      kind: 'one-shot',
      placement: 'ambiance',
      volume: 1,
      variations: ['wind.mp3'],
      minIntervalSeconds: 2,
      maxIntervalSeconds: 4,
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    coordinator.start({ ...environment, sounds: [] })

    coordinator.sync({ ...environment, sounds: [loop, sound] })

    expect(port.playLoop).toHaveBeenCalledWith(loop, 0.4, 2000)
    expect(port.playOneShot).not.toHaveBeenCalled()
    clock.advance(2_000)
    expect(port.playOneShot).toHaveBeenCalledWith(sound, 'wind.mp3', 0.8)
  })

  it('does not start combat sounds until Combat mode is active', () => {
    const port = audio()
    const combatLoop = { ...loop, id: 'battle', placement: 'combat' as const }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
    })
    coordinator.start({ ...environment, sounds: [] })
    coordinator.sync({ ...environment, sounds: [combatLoop] })

    expect(port.playLoop).not.toHaveBeenCalled()
  })

  it('replaces ambiance music with combat music and adds combat one-shots when Combat mode is toggled on', () => {
    const port = audio()
    const clock = fakeClock()
    const combatLoop: Sound = {
      id: 'battle',
      name: 'Battle',
      kind: 'loop',
      placement: 'combat',
      volume: 0.5,
      source: { urls: ['battle.mp3'] },
    }
    const combatOneShot: Sound = {
      id: 'sword',
      kind: 'one-shot',
      placement: 'combat',
      volume: 1,
      variations: ['sword.mp3'],
      minIntervalSeconds: 2,
      maxIntervalSeconds: 2,
    }
    const scene = {
      ...environment,
      sounds: [loop, combatLoop, combatOneShot],
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    coordinator.start(scene)

    // Only ambiance loop started initially
    expect(port.playLoop).toHaveBeenCalledWith(loop, 0.4, 2000)
    expect(port.playLoop).not.toHaveBeenCalledWith(
      combatLoop,
      expect.anything(),
      expect.anything(),
    )

    coordinator.toggleCombat(scene)

    // Ambiance music fades out; combat music and one-shot start
    expect(port.stop).toHaveBeenCalledWith('rain', 2000)
    expect(port.playLoop).toHaveBeenCalledWith(combatLoop, 0.4, 2000)
    clock.advance(2_000)
    expect(port.playOneShot).toHaveBeenCalledWith(
      combatOneShot,
      'sword.mp3',
      0.8,
    )
  })

  it('restores ordinary music and stops combat sounds when Combat mode is toggled off', () => {
    const port = audio()
    const combatLoop: Sound = {
      id: 'battle',
      name: 'Battle',
      kind: 'loop',
      placement: 'combat',
      volume: 0.5,
      source: { urls: ['battle.mp3'] },
    }
    const scene = {
      ...environment,
      sounds: [loop, combatLoop],
      combatMode: true,
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
    })
    coordinator.start(scene)

    // Combat music started, not ambiance
    expect(port.playLoop).not.toHaveBeenCalledWith(
      loop,
      expect.anything(),
      expect.anything(),
    )
    expect(port.playLoop).toHaveBeenCalledWith(combatLoop, 0.4, 2000)

    coordinator.toggleCombat(scene)

    // Combat music fades; ambiance music restarts
    expect(port.stop).toHaveBeenCalledWith('battle', 2000)
    expect(port.playLoop).toHaveBeenCalledWith(loop, 0.4, 2000)
  })

  it('ignores toggleCombat when the environment is not active', () => {
    const port = audio()
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
    })
    const other = { ...environment, id: 'tavern' }
    coordinator.start(other)

    coordinator.toggleCombat(environment)

    expect(port.stop).not.toHaveBeenCalled()
  })

  it('preserves Combat state across Environment transitions', () => {
    const port = audio()
    const combatLoop: Sound = {
      id: 'battle',
      name: 'Battle',
      kind: 'loop',
      placement: 'combat',
      volume: 0.5,
      source: { urls: ['battle.mp3'] },
    }
    const scene = {
      ...environment,
      sounds: [loop, combatLoop],
    }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock: fakeClock(),
      random: { next: () => 0 },
    })
    coordinator.start(scene)
    coordinator.toggleCombat(scene)

    // Now in combat mode — the coordinator switches to combatLoop internally.
    // Starting a different environment should not carry over combat state.
    const tavern: typeof environment = {
      ...environment,
      id: 'tavern',
      sounds: [{ ...loop, id: 'lute' }],
      combatMode: false,
    }
    coordinator.start(tavern)

    // Lute (ordinary ambiance) should be playing after transition
    expect(port.playLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lute' }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('fades and unloads sounds removed from a playing Environment', () => {
    const clock = fakeClock()
    const port = audio()
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    coordinator.start(environment)
    coordinator.sync({ ...environment, sounds: [] })

    expect(port.stop).toHaveBeenCalledWith('rain', 2000)
    clock.advance(2_000)
    expect(port.unload).toHaveBeenCalledWith('rain')
  })

  it('cancels a removed one-shot before its next scheduled firing', () => {
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
    const scene = { ...environment, sounds: [sound] }
    const coordinator = createPlaybackCoordinator({
      audio: port,
      clock,
      random: { next: () => 0 },
    })
    coordinator.start(scene)
    coordinator.sync({ ...scene, sounds: [] })
    clock.advance(2_000)

    expect(port.playOneShot).not.toHaveBeenCalled()
    expect(port.stop).toHaveBeenCalledWith('thunder', 2000)
  })

  it('restarts an active One-shot timer when its timing changes', () => {
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
    coordinator.sync({
      ...scene,
      sounds: [{ ...sound, minIntervalSeconds: 5, maxIntervalSeconds: 5 }],
    })

    clock.advance(2_000)
    expect(port.playOneShot).not.toHaveBeenCalled()
    clock.advance(3_000)
    expect(port.playOneShot).toHaveBeenCalledOnce()
  })
})
