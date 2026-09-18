const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const exported = {}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/join-party.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exported })
const { joinPartyByCode } = exported

function fixture(options = {}) {
  const inserts = []
  const party = { id: 'abcdef12-3456-7890-abcd-123456789012', max_players: 4 }
  const client = {
    auth: { getSession: async () => ({ data: { session: options.signedOut ? null : { user: { id: 'player', is_anonymous: !!options.guest } } } }) },
    from(table) {
      const query = {
        select(_columns, settings) { query.counting = !!settings?.head; return query },
        eq() { return query },
        maybeSingle: async () => ({ data: options.member ? { user_id: 'player' } : null }),
        then(resolve) { return Promise.resolve(table === 'parties'
          ? { data: options.missing ? [] : [party], error: options.lookupError }
          : { count: options.full ? 4 : 1 }).then(resolve) },
        insert: async row => { inserts.push(row); return { error: options.insertError } },
      }
      return query
    },
  }
  return { client, inserts, party }
}

for (const guest of [false, true]) {
  test(`joins with normalized code for ${guest ? 'guest' : 'account'} session`, async () => {
    const { client, inserts, party } = fixture({ guest })
    assert.equal(await joinPartyByCode(client, ' abcdef '), party.id)
    assert.equal(inserts.length, 1)
    assert.equal(inserts[0].party_id, party.id)
    assert.equal(inserts[0].user_id, 'player')
    assert.equal(inserts[0].role, 'member')
  })
}
test('existing members can rejoin a full party without an insert', async () => {
  const { client, inserts, party } = fixture({ member: true, full: true })
  assert.equal(await joinPartyByCode(client, 'ABCDEF'), party.id)
  assert.equal(inserts.length, 0)
})
for (const [options, code, message] of [
  [{}, 'abc', /valid 6-character/],
  [{ signedOut: true }, 'ABCDEF', /signed in/],
  [{ missing: true }, 'ABCDEF', /not found/],
  [{ full: true }, 'ABCDEF', /already full/],
  [{ lookupError: new Error('lookup denied') }, 'ABCDEF', /lookup denied/],
  [{ insertError: new Error('insert denied') }, 'ABCDEF', /insert denied/],
]) {
  test(`rejects ${message}`, async () => {
    const { client } = fixture(options)
    await assert.rejects(joinPartyByCode(client, code), message)
  })
}
