import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { stackFragment } from '../src/compile'
import { presetStack } from '../src/presetStack'
import { PRESET_IDS } from '../src/presets'

// Presets are frozen: an embed using preset="silk" must look the same forever. If this fails,
// add a new preset instead of changing one (or, before anything is published, regenerate
// presets.frozen.json on purpose and say so in the commit).
const frozen = JSON.parse(readFileSync(new URL('./presets.frozen.json', import.meta.url), 'utf8'))

test('every preset is unchanged', () => {
  assert.deepEqual(Object.keys(frozen), [...PRESET_IDS])
  for (const id of PRESET_IDS) assert.deepEqual(JSON.parse(JSON.stringify(presetStack(id))), frozen[id], id)
})

test('every preset builds and compiles', () => {
  for (const id of PRESET_IDS) assert.ok(stackFragment(presetStack(id)).includes('void main()'), id)
})
