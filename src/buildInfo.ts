// Vite embeds these values in the bundle; an open tab keeps its own identity.
export const buildInfo = {
  commit: import.meta.env.VITE_BUILD_COMMIT ?? 'local',
  buildId: import.meta.env.VITE_BUILD_ID ?? 'local',
  builtAt: import.meta.env.VITE_BUILD_TIME ?? 'development',
}
