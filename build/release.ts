export interface BuildIdentity {
  buildId: string
  sourceSha: string
  artifactId: string
  artifactDigest: string
}

export interface Publication extends BuildIdentity {
  schema: 1
  intent: string
  version: string
}

export interface Deployment {
  id: number
  sha: string
  payload: Partial<Publication> & { kind?: string }
}

export function versionParts(version: string) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(
      'Version must be vMAJOR.MINOR.PATCH without prerelease suffixes',
    )
  }
  return version.slice(1).split('.').map(BigInt)
}

export function compareVersions(a: string, b: string) {
  const left = versionParts(a)
  const right = versionParts(b)
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1
  }
  return 0
}

export function nextVersion(used: string[]) {
  const numbered = used.filter((tag) =>
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag),
  )
  if (!numbered.length) return 'v0.1.0'
  const highest = numbered.sort(compareVersions).at(-1)!
  const [major, minor, patch] = versionParts(highest)
  return `v${major}.${minor}.${patch + 1n}`
}

export function assertForward(
  publication: Publication,
  deployments: Deployment[],
) {
  for (const { payload } of deployments) {
    if (payload.kind !== 'turbobard-production') continue
    if (!payload.version) throw new Error('Malformed production history')
    const order = compareVersions(publication.version, payload.version)
    if (order < 0)
      throw new Error(
        'A newer production version has already been attempted; publish a higher version',
      )
    if (
      order === 0 &&
      (payload.intent !== publication.intent ||
        payload.buildId !== publication.buildId ||
        payload.sourceSha !== publication.sourceSha ||
        payload.artifactId !== publication.artifactId ||
        payload.artifactDigest !== publication.artifactDigest)
    )
      throw new Error(
        'Production version is already associated with another publication',
      )
  }
}

export function assertPublication(
  value: Publication,
  expected: BuildIdentity,
  intent: string,
) {
  versionParts(value.version)
  if (
    value.schema !== 1 ||
    value.intent !== intent ||
    value.buildId !== expected.buildId ||
    value.sourceSha !== expected.sourceSha ||
    value.artifactId !== expected.artifactId ||
    value.artifactDigest !== expected.artifactDigest
  ) {
    throw new Error('Publication intent/build mismatch')
  }
}
