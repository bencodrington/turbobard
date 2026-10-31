import type { Sound } from './playback'

export const intervalPresets = [1, 4, 6, 10, 30, 60] as const
export const variationPresets = [0, 1, 2, 4, 8, 16] as const

export function timingRange(intervalSeconds: number, variationSeconds: number) {
  return {
    minimum: Math.max(0, intervalSeconds - variationSeconds),
    maximum: intervalSeconds + variationSeconds,
  }
}

export function soundTiming(sound: Sound) {
  const minimum = sound.minIntervalSeconds ?? 0
  const maximum = sound.maxIntervalSeconds ?? minimum
  if (sound.timing) {
    const range = timingRange(
      sound.timing.intervalSeconds,
      sound.timing.variationSeconds,
    )
    if (range.minimum === minimum && range.maximum === maximum)
      return sound.timing
  }
  return {
    intervalSeconds: (minimum + maximum) / 2,
    variationSeconds: (maximum - minimum) / 2,
  }
}

export function nearestPreset(value: number, presets: readonly number[]) {
  return presets.reduce((nearest, preset) =>
    Math.abs(preset - value) < Math.abs(nearest - value) ? preset : nearest,
  )
}
