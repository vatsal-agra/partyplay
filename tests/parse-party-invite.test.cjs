const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsePartyInvite } = require('../lib/parse-party-invite.ts')
const origins = ['https://dice-alley.netlify.app', 'http://localhost:3000']
const id = 'abcdef12-3456-7890-abcd-123456789012'
const parse = input => parsePartyInvite(input, origins)

for (const input of ['ABC123', 'abc123', 'AbC123', ' \tABC123\r\n']) {
  test(`normalizes code ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parse(input), { kind: 'code', code: 'ABC123' })
  })
}
for (const input of [
  `https://dice-alley.netlify.app/party/${id}`,
  `https://dice-alley.netlify.app/party/${id.toUpperCase()}?from=chat#join`,
  ` \nhttps://dice-alley.netlify.app/party/${id}/ \t`,
  `http://localhost:3000/party/${id}`,
]) {
  test(`preserves full party identity ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parse(input), { kind: 'party', partyId: id })
  })
}
for (const input of [
  'Party code: ABC123',
  'Join my Dice Alley game night! Party code: abc123',
  ' \nJoin us!\nParty code: AbC123\nSee you there. \t',
  'party code: ABC123!',
]) {
  test(`extracts labeled share code ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parse(input), { kind: 'code', code: 'ABC123' })
  })
}
for (const input of [
  '', ' \n\t ', 'ABC12', 'ABC1234', 'GHI123', 'ABC 123', 'Join ABC123',
  'unrelated text', 'Party code: ABC1234', 'Party code: ABC123_xyz',
  'Party code: ABC123-456', 'Party code: ABC123 Party code: DEF456',
  `https://dice-alley.netlify.app/party/abcdef`,
  `https://dice-alley.netlify.app/party/${id.slice(0, -1)}`,
  `https://dice-alley.netlify.app/party/${id.replace('a', 'g')}`,
  `https://dice-alley.netlify.app/party/${id}/extra`,
  `https://dice-alley.netlify.app/other/../party/${id}`,
  `https://example.com/party/${id}`,
  `https://dice-alley.netlify.app.evil.test/party/${id}`,
  `https://user@dice-alley.netlify.app/party/${id}`,
  `ftp://dice-alley.netlify.app/party/${id}`,
  `/party/${id}`, `https://dice-alley.netlify.app/party/${id} trailing text`,
]) {
  test(`rejects malformed or unrelated input ${JSON.stringify(input)}`, () => {
    assert.equal(parse(input), null)
  })
}
test('does not collapse parties sharing the same code prefix', () => {
  const other = 'abcdef99-3456-7890-abcd-123456789012'
  assert.equal(parse(`https://dice-alley.netlify.app/party/${other}`).partyId, other)
})
