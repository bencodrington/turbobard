// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createBuildInfo } from './metadata'

const commit = 'a'.repeat(40)
const now = new Date('2026-10-29T12:00:00.000Z')

describe('build identity', () => {
  it('distinguishes CI attempts of the same commit', () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      TURBOBARD_BUILD_COMMIT: commit,
      TURBOBARD_BUILD_ID: '123.1',
    }
    expect(createBuildInfo(env, 'other', now)).toEqual({
      commit,
      buildId: '123.1',
      builtAt: now.toISOString(),
    })
    expect(
      createBuildInfo({ ...env, TURBOBARD_BUILD_ID: '123.2' }, 'other', now)
        .buildId,
    ).toBe('123.2')
  })

  it('fails closed when CI identity is missing or malformed', () => {
    expect(() => createBuildInfo({ GITHUB_ACTIONS: 'true' }, commit)).toThrow(
      /source SHA/,
    )
    expect(() =>
      createBuildInfo(
        { GITHUB_ACTIONS: 'true', TURBOBARD_BUILD_COMMIT: commit },
        commit,
      ),
    ).toThrow(/run ID and attempt/)
    expect(() =>
      createBuildInfo(
        {
          GITHUB_ACTIONS: 'true',
          TURBOBARD_BUILD_COMMIT: 'abcdef0',
          TURBOBARD_BUILD_ID: '123.1',
        },
        commit,
      ),
    ).toThrow(/source SHA/)
  })

  it('identifies local builds without claiming a CI run', () => {
    expect(createBuildInfo({}, commit, now)).toEqual({
      commit,
      buildId: 'local',
      builtAt: now.toISOString(),
    })
  })
})
