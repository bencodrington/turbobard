/** Creates a small audible, dependency-free demo source for the local catalog. */
export function demoAudioSource(seed: number): string {
  const sampleRate = 8_000
  const sampleCount = sampleRate
  const bytes = new Uint8Array(44 + sampleCount)
  const view = new DataView(bytes.buffer)
  const writeText = (offset: number, value: string) =>
    [...value].forEach((character, index) => {
      bytes[offset + index] = character.charCodeAt(0)
    })
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount, true)
  writeText(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeText(36, 'data')
  view.setUint32(40, sampleCount, true)
  let state = seed
  for (let index = 0; index < sampleCount; index += 1) {
    state = (state * 1_103_515_245 + 12_345) >>> 0
    const noise = ((state >>> 24) - 128) * 0.12
    const tone =
      Math.sin((index / sampleRate) * Math.PI * 2 * (180 + seed * 20)) * 18
    bytes[44 + index] = Math.max(0, Math.min(255, 128 + noise + tone))
  }
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
}
