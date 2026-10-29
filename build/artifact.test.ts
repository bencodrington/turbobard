// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyArchive, verifyArtifact, verifyBuildInfo } from './artifact'

const archive = new TextEncoder().encode('retained output')
const digest = createHash('sha256').update(archive).digest('hex')
const expected = { id: '456', buildId: '123.2', digest }
const artifact = {
  id: 456,
  name: 'build-123.2',
  expired: false,
  digest: `sha256:${digest}`,
  workflow_run: { id: 123 },
}

describe('retained build validation', () => {
  it('accepts the selected artifact and its unchanged archive', () => {
    expect(() => verifyArtifact(artifact, expected)).not.toThrow()
    expect(() => verifyArchive(archive, digest)).not.toThrow()
  })

  it.each([
    { expired: true },
    { id: 789 },
    { name: 'build-123.1' },
    { digest: `sha256:${'0'.repeat(64)}` },
    { workflow_run: { id: 999 } },
  ])('rejects a mismatched or expired artifact: %j', (change) => {
    expect(() => verifyArtifact({ ...artifact, ...change }, expected)).toThrow()
  })

  it('rejects missing digests and tampered archive bytes', () => {
    expect(() =>
      verifyArtifact(artifact, { ...expected, digest: '' }),
    ).toThrow()
    expect(() => verifyArchive(new Uint8Array([1, 2, 3]), digest)).toThrow(
      /SHA-256 mismatch/,
    )
  })

  it('rejects another attempt or source, even if the archive is intact', () => {
    const info = {
      commit: 'a'.repeat(40),
      buildId: '123.2',
      builtAt: '2026-10-29T12:00:00.000Z',
    }
    expect(() => verifyBuildInfo(info, info)).not.toThrow()
    expect(() => verifyBuildInfo(info, { ...info, buildId: '123.1' })).toThrow(
      /source\/build identity/,
    )
    expect(() =>
      verifyBuildInfo(info, { ...info, commit: 'b'.repeat(40) }),
    ).toThrow(/source\/build identity/)
    expect(() =>
      verifyBuildInfo({ ...info, builtAt: 'invalid' }, info),
    ).toThrow()
  })
})
