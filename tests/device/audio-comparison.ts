import { createBrowserAudioPort } from '../../src/audio/browser'
import { createPlaybackCoordinator } from '../../src/domain/coordinator'
import type { Environment, Sound } from '../../src/domain/playback'

type RecordEntry = {
  element: HTMLAudioElement
  analyser: AnalyserNode
  data: Float32Array<ArrayBuffer>
  routed: boolean
  gain?: GainNode
}
type Sample = {
  ms: number
  phase: string
  sound: number
  rms: number
  volume: number
  gain?: number
  paused: boolean
  mediaTime: number
  readyState: number
  contextTime: number
  contextState: string
}

function wavUrl(frequency: number) {
  const rate = 44100
  const count = rate * 8
  const buffer = new ArrayBuffer(44 + count * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) =>
      view.setUint8(offset + i, char.charCodeAt(0)),
    )
  text(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++)
    view.setInt16(
      44 + i * 2,
      Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 16383),
      true,
    )
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const mode = new URLSearchParams(location.search).get('mode')
if (mode !== 'natural') throw new Error('Select natural production mode')
const state = window as typeof window & {
  deviceResult?: unknown
  deviceError?: string
  deviceReady?: boolean
  deviceProgress?: unknown
  deviceInputEvents?: unknown[]
  waitingForGesture?: string
}
state.deviceInputEvents = []
for (const name of [
  'touchstart',
  'touchend',
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'contextmenu',
])
  document.addEventListener(
    name,
    (event) => {
      const pointer = event as PointerEvent
      state.deviceInputEvents!.push({
        type: name,
        target: (event.target as Element)?.id,
        trusted: event.isTrusted,
        x: pointer.clientX,
        y: pointer.clientY,
        at: performance.now(),
      })
    },
    true,
  )
window.addEventListener('error', (event) => {
  state.deviceError = event.message
})
window.addEventListener('unhandledrejection', (event) => {
  state.deviceError = String(event.reason)
})
document.getElementById('run')!.onclick = async () => {
  state.deviceProgress = { phase: 'tap-received' }
  ;(document.getElementById('run') as HTMLButtonElement).disabled = true
  const context = new AudioContext()
  const speakers = context.destination
  const sink = context.createMediaStreamDestination()
  const nativeConnect = AudioNode.prototype.connect
  // Fail closed even if the adapter changes its routing implementation.
  AudioNode.prototype.connect = function (
    destination: AudioNode | AudioParam,
    ...args: number[]
  ) {
    if (destination === speakers)
      throw new Error('Speaker connection forbidden')
    return Reflect.apply(nativeConnect, this, [destination, ...args])
  } as typeof nativeConnect
  Object.defineProperty(context, 'destination', { value: sink })
  const records: RecordEntry[] = []
  const samples: Sample[] = []
  const errors: string[] = []
  const events: unknown[] = []
  const urls = [wavUrl(440), wavUrl(660)]
  let phase = 'setup'
  let phaseStarted = performance.now()
  const setPhase = (name: string) => {
    phase = name
    phaseStarted = performance.now()
    events.push({
      phase,
      at: phaseStarted,
      visibility: document.visibilityState,
    })
    document.getElementById('status')!.textContent = `${mode}: ${phase}`
  }
  const nativeSource = context.createMediaElementSource.bind(context)
  const nativeGain = context.createGain.bind(context)
  let sourceRecord: RecordEntry | undefined
  context.createMediaElementSource = (element) => {
    sourceRecord = records.find((r) => r.element === element)
    return nativeSource(element)
  }
  context.createGain = () => {
    const gain = nativeGain()
    const record = sourceRecord
    if (!record) throw new Error('Gain has no source')
    record.gain = gain
    const connect = gain.connect.bind(gain)
    gain.connect = ((destination: AudioNode) => {
      if (destination !== sink)
        throw new Error('Unexpected adapter destination')
      connect(record.analyser)
      record.analyser.connect(sink)
      record.routed = true
      return sink
    }) as typeof gain.connect
    return gain
  }
  let contextFactoryCalls = 0
  const port = createBrowserAudioPort(
    (src?: string) => {
      const element = new Audio()
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      const record: RecordEntry = {
        element,
        analyser,
        data: new Float32Array(analyser.fftSize),
        routed: false,
      }
      records.push(record)
      const play = element.play.bind(element)
      element.play = () =>
        record.routed
          ? play()
          : Promise.reject(new Error('Playback refused: no stream-only graph'))
      for (const name of ['playing', 'waiting', 'pause', 'error', 'emptied'])
        element.addEventListener(name, () =>
          events.push({
            name,
            sound: records.indexOf(record),
            phase,
            ms: performance.now() - phaseStarted,
            mediaTime: element.currentTime,
          }),
        )
      if (src) element.src = src
      return element
    },
    () => {
      contextFactoryCalls++
      return context
    },
  )
  port.onError?.((_id: string, error: unknown) => errors.push(String(error)))
  const sounds: Sound[] = urls.map((url, i) => ({
    id: `device-tone-${i}`,
    kind: 'loop',
    placement: 'ambiance',
    volume: 1,
    source: { urls: [url] },
  }))
  const environments: Environment[] = sounds.map((sound, i) => ({
    id: `device-environment-${i}`,
    name: `Device ${i}`,
    volume: 1,
    sounds: [sound],
    playing: false,
    combatMode: false,
    icon: null,
    iconColor: null,
  }))
  const coordinator = createPlaybackCoordinator({
    audio: port,
    clock: {
      now: () => performance.now(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (id) => window.clearTimeout(id as number),
    },
    random: { next: () => 0.5 },
    onSoundError: (_id, error) => errors.push(String(error)),
  })
  const nextGesture = (name: string, action: () => void) =>
    new Promise<void>((resolve) => {
      const button = document.getElementById('run') as HTMLButtonElement
      state.waitingForGesture = name
      button.textContent = name
      button.disabled = false
      button.onclick = () => {
        button.disabled = true
        state.waitingForGesture = undefined
        setPhase(name)
        action()
        resolve()
      }
    })
  const timer = window.setInterval(() => {
    state.deviceProgress = {
      phase,
      contextState: context.state,
      contextTime: context.currentTime,
      errors,
      lastSamples: samples.slice(-3),
      visibility: document.visibilityState,
    }
    records.forEach((record, sound) => {
      record.analyser.getFloatTimeDomainData(record.data)
      samples.push({
        phase,
        sound,
        ms: performance.now() - phaseStarted,
        rms: Math.sqrt(
          record.data.reduce((sum, x) => sum + x * x, 0) / record.data.length,
        ),
        volume: record.element.volume,
        gain: record.gain?.gain.value,
        paused: record.element.paused,
        mediaTime: record.element.currentTime,
        readyState: record.element.readyState,
        contextTime: context.currentTime,
        contextState: context.state,
      })
    })
  }, 40)
  try {
    // Resume and start occur synchronously in the WebDriver-generated tap.
    const resume = context.resume()
    setPhase('fade-in')
    coordinator.start(environments[0])
    await resume
    await sleep(2800)
    setPhase('half-level')
    port.setVolume(sounds[0].id, 0.5)
    await sleep(600)
    setPhase('full-level')
    port.setVolume(sounds[0].id, 1)
    await sleep(600)
    setPhase('stop')
    coordinator.stop(environments[0])
    await sleep(2350)
    await nextGesture('restart', () => coordinator.start(environments[0]))
    await sleep(2800)
    await nextGesture('switch', () => coordinator.start(environments[1]))
    await sleep(2800)
    setPhase('stop-incoming')
    coordinator.stop(environments[1])
    await sleep(2350)
    state.deviceResult = {
      mode,
      userAgent: navigator.userAgent,
      contextFactoryCalls,
      samples,
      events,
      inputEvents: state.deviceInputEvents,
      errors,
      output: 'unplayed MediaStream',
      outputAudioVerified: false,
      measurementCaveat:
        'Adapter output redirected to an unplayed stream; ordinary speaker route remains unverified.',
    }
  } catch (error) {
    state.deviceError = String(error)
  } finally {
    window.clearInterval(timer)
    coordinator.dispose()
    for (const sound of sounds) port.unload(sound.id)
    for (const record of records) record.element.pause()
    await context.close()
    AudioNode.prototype.connect = nativeConnect
    for (const url of urls) URL.revokeObjectURL(url)
    document.getElementById('status')!.textContent = state.deviceError ?? 'Done'
  }
}
state.deviceReady = true
