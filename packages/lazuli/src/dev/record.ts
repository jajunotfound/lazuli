// Dev check for video export: records a short clip and exposes it as base64 on
// window.recorded, so a headless driver can save it for ffprobe. Not part of the build.
import { record } from '../capture'

const q = new URLSearchParams(location.search)
const format = (q.get('format') ?? 'mp4') as 'mp4' | 'webm'
const t0 = performance.now()
record({ preset: 'silk', motion: { loop: 4, speed: 0.6 } }, { width: 640, height: 360, fps: 30, format })
  .then(async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    Object.assign(window, { recorded: btoa(bin), took: Math.round(performance.now() - t0) })
  })
  .catch((e) => Object.assign(window, { recorded: 'ERROR ' + String(e) }))
