import { createHash } from 'node:crypto'
import type { BuildInfo } from './metadata.ts'

interface Artifact {
  id: number
  name: string
  expired: boolean
  digest: string
  workflow_run: { id: number }
}

export function verifyArtifact(
  value: unknown,
  expected: { id: string; buildId: string; digest: string },
) {
  if (!value || typeof value !== 'object') {
    throw new Error('Missing artifact metadata')
  }
  const artifact = value as Partial<Artifact>
  if (!/^[a-f0-9]{64}$/.test(expected.digest)) {
    throw new Error('Missing or invalid expected artifact digest')
  }
  if (
    String(artifact.id) !== expected.id ||
    artifact.name !== `build-${expected.buildId}` ||
    String(artifact.workflow_run?.id) !== expected.buildId.split('.')[0] ||
    artifact.digest !== `sha256:${expected.digest}` ||
    artifact.expired !== false
  ) {
    throw new Error(
      'Artifact identity/digest mismatch or expired artifact; restage',
    )
  }
}

export function verifyArchive(archive: Uint8Array, digest: string) {
  if (createHash('sha256').update(archive).digest('hex') !== digest) {
    throw new Error('Downloaded artifact SHA-256 mismatch')
  }
}

export function verifyBuildInfo(
  info: BuildInfo,
  expected: { commit: string; buildId: string },
) {
  if (
    !/^[a-f0-9]{40}$/.test(expected.commit) ||
    !/^[1-9]\d*\.[1-9]\d*$/.test(expected.buildId) ||
    info.commit !== expected.commit ||
    info.buildId !== expected.buildId ||
    !Number.isFinite(Date.parse(info.builtAt))
  ) {
    throw new Error(
      'Built files do not match the selected source/build identity',
    )
  }
}
