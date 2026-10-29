export interface BuildInfo {
  commit: string
  buildId: string
  builtAt: string
}

export function createBuildInfo(
  env: Record<string, string | undefined>,
  localCommit: string,
  now = new Date(),
): BuildInfo {
  if (env.GITHUB_ACTIONS === 'true') {
    if (!/^[a-f0-9]{40}$/.test(env.TURBOBARD_BUILD_COMMIT ?? '')) {
      throw new Error('CI builds require the full checked-out source SHA')
    }
    if (!/^[1-9]\d*\.[1-9]\d*$/.test(env.TURBOBARD_BUILD_ID ?? '')) {
      throw new Error('CI builds require a run ID and attempt (runId.attempt)')
    }
  }
  return {
    commit: env.TURBOBARD_BUILD_COMMIT ?? localCommit,
    buildId: env.TURBOBARD_BUILD_ID ?? 'local',
    builtAt: now.toISOString(),
  }
}
