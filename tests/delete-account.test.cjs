const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const exported = {}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/delete-account.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exported })

test('deletion calls only the caller RPC and requires explicit confirmation', async () => {
  for (const response of [{ data: true, error: null }, { data: null, error: { message: 'blocked' } }, { data: null, error: null }, { data: false, error: null }]) {
    const client = { rpc: async (...args) => {
      assert.deepEqual(args, ['delete_my_account'])
      return response
    } }
    if (response.data === true) await exported.deleteAccount(client)
    else await assert.rejects(exported.deleteAccount(client), /not.*confirmed/)
  }
})

test('post-deletion sign out is local and surfaces failure independently', async () => {
  for (const error of [null, { message: 'offline' }]) {
    const client = { auth: { signOut: async options => {
      assert.equal(options.scope, 'local')
      return { error }
    } } }
    if (error) await assert.rejects(exported.signOutDeletedAccount(client), /account was deleted.*signing out failed/)
    else await exported.signOutDeletedAccount(client)
  }
})
