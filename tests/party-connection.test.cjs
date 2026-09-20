// Run with: node --test tests/party-connection.test.cjs
// The helper is pure and touches no browser globals, so it loads directly
// through Node's own type stripping instead of the vm + typescript harness the
// storage-backed helpers need.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  INITIAL_PARTY_CONNECTION,
  channelStateFromStatus,
  partyConnectionStatus,
} = require('../lib/partyConnection.ts')

const status = (overrides) => partyConnectionStatus({ ...INITIAL_PARTY_CONNECTION, ...overrides })

test('a healthy channel and a first subscribe say nothing', () => {
  assert.equal(status({ channel: 'subscribed' }), null)
  assert.equal(status({ channel: 'idle' }), null)
  assert.equal(status({ channel: 'subscribing' }), null)
})

test('supabase statuses map onto channel states, unknown ones read as subscribing', () => {
  assert.equal(channelStateFromStatus('SUBSCRIBED'), 'subscribed')
  assert.equal(channelStateFromStatus('CHANNEL_ERROR'), 'error')
  assert.equal(channelStateFromStatus('TIMED_OUT'), 'timeout')
  assert.equal(channelStateFromStatus('CLOSED'), 'closed')
  assert.equal(channelStateFromStatus('JOINING'), 'subscribing')
  assert.equal(channelStateFromStatus(''), 'subscribing')
})

test('a broken channel alerts and offers a retry', () => {
  for (const channel of ['error', 'timeout', 'closed']) {
    const banner = status({ channel })
    assert.equal(banner.role, 'alert')
    assert.equal(banner.tone, 'dropped')
    assert.equal(banner.canRetry, true)
    assert.match(banner.message, /out of date/)
  }
})

test('offline is stated as offline, reconnecting as reconnecting', () => {
  const offline = status({ online: false, channel: 'subscribed' })
  assert.equal(offline.tone, 'offline')
  assert.equal(offline.role, 'status')
  assert.match(offline.message, /internet connection/)

  const reconnecting = status({ channel: 'error', recovering: true })
  assert.equal(reconnecting.tone, 'reconnecting')
  assert.equal(reconnecting.role, 'status')
  assert.notEqual(reconnecting.message, offline.message)
  // Nothing to retry while a retry is already running.
  assert.equal(reconnecting.canRetry, false)
})

test('being offline outranks a channel that broke because of it', () => {
  const banner = status({ online: false, channel: 'timeout', lastError: 'Could not refresh the party: failed to fetch.' })
  assert.equal(banner.tone, 'offline')
  // An offline reconnect is still worth letting people force.
  assert.equal(banner.canRetry, true)
  assert.equal(status({ online: false, recovering: true }).canRetry, false)
})

test('a failed recovery reports its reason and survives a still broken channel', () => {
  const banner = status({ channel: 'closed', lastError: 'Could not refresh the party: network error.' })
  assert.equal(banner.role, 'alert')
  assert.match(banner.message, /^Could not refresh the party: network error\. /)
  assert.match(banner.message, /out of date/)
  assert.equal(banner.title, 'Could not reconnect')
})

test('the initial state is silent and the helper never mutates its input', () => {
  const connection = { ...INITIAL_PARTY_CONNECTION, channel: 'error', recovering: true }
  const snapshot = { ...connection }
  partyConnectionStatus(connection)
  assert.deepEqual(connection, snapshot)
  assert.equal(partyConnectionStatus(INITIAL_PARTY_CONNECTION), null)
})
