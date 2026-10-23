import { describe, expect, it, vi } from 'vitest'
import {
  activeSounds,
  chooseVariation,
  nextOneShotDelayMs,
  playManualOneShot,
  restoreEnvironment,
  startEnvironment,
  stopEnvironment,
  type Environment,
  type Sound,
} from './playback'
import { deterministicRandom, fakeClock } from './ports'

const loop = (
  id: string,
  placement: Sound['placement'] = 'ambiance',
): Sound => ({ id, kind: 'loop', placement, volume: 0.5 })
const oneShot = (
  id: string,
  placement: Sound['placement'] = 'ambiance',
): Sound => ({
  id,
  kind: 'one-shot',
  placement,
  volume: 1,
  variations: ['a', 'b'],
  minIntervalSeconds: 2,
  maxIntervalSeconds: 6,
})
const environment: Environment = {
  id: 'forest',
  name: 'Forest',
  volume: 0.8,
  sounds: [
    loop('music'),
    loop('combat-music', 'combat'),
    oneShot('wind'),
    oneShot('sword', 'combat'),
  ],
  playing: false,
  combatMode: false,
}

describe('legacy playback contract', () => {
  it('starts ordinary music and ambiance, and stops the previously active environment with a two-second fade', () => {
    expect(
      startEnvironment(environment, 'tavern', {
        random: () => 0,
        schedule: vi.fn(),
        audio: { playManualOneShot: vi.fn() },
      }),
    ).toEqual([
      { type: 'stop-environment', environmentId: 'tavern', fadeMs: 2000 },
      {
        type: 'play-loop',
        environmentId: 'forest',
        soundId: 'music',
        volume: 0.4,
        fadeMs: 2000,
      },
      {
        type: 'schedule-one-shot',
        environmentId: 'forest',
        soundId: 'wind',
        delayMs: 2000,
      },
    ])
  })

  it('replaces music and layers combat ambiance in Combat mode', () => {
    expect(
      activeSounds({ ...environment, combatMode: true }).map(({ id }) => id),
    ).toEqual(['combat-music', 'wind', 'sword'])
  })

  it('restores legacy data stopped and without eager loading', () => {
    expect(
      restoreEnvironment(
        {
          name: 'Old',
          sounds: [loop('music')],
          playing: true,
        },
        () => 'old',
      ),
    ).toMatchObject({
      playing: false,
      sounds: [{ id: 'music', loaded: false }],
    })
  })

  it('uses inclusive randomized one-shot timing and variation selection', () => {
    expect(nextOneShotDelayMs(oneShot('owl'), 1)).toBe(6000)
    expect(chooseVariation(oneShot('owl'), 0.99)).toBe('b')
  })

  it('plays manual one-shots independently through a separate audio port', () => {
    const play = vi.fn()
    expect(
      playManualOneShot('forest', oneShot('owl'), {
        random: () => 0,
        schedule: vi.fn(),
        audio: { playManualOneShot: play },
      }),
    ).toMatchObject({ variation: 'a', manual: true })
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owl' }),
      'a',
    )
  })

  it('exposes deterministic clock and randomness ports for focused tests', () => {
    const clock = fakeClock()
    const fired = vi.fn()
    clock.setTimeout(fired, 500)
    clock.advance(499)
    expect(fired).not.toHaveBeenCalled()
    clock.advance(1)
    expect(fired).toHaveBeenCalledOnce()
    const random = deterministicRandom([0.25, 0.75])
    expect([random.next(), random.next()]).toEqual([0.25, 0.75])
  })

  it('unloads every loop during lifecycle cleanup', () => {
    expect(stopEnvironment(environment)).toEqual([
      { type: 'stop-environment', environmentId: 'forest', fadeMs: 2000 },
      { type: 'unload-sound', soundId: 'music' },
      { type: 'stop-environment', environmentId: 'forest', fadeMs: 2000 },
      { type: 'unload-sound', soundId: 'combat-music' },
    ])
  })
})
