import { describe, expect, it, vi } from 'vitest'
import {
  activeSounds,
  chooseVariation,
  nextOneShotDelayMs,
  restoreEnvironment,
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
  expanded: true,
  icon: null,
  iconColor: null,
  sounds: [
    loop('music'),
    loop('combat-music', 'combat'),
    oneShot('wind'),
    oneShot('sword', 'combat'),
  ],
  playing: false,
  combatMode: false,
}

describe('playback policy', () => {
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
})
