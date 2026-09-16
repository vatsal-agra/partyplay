// Run with: node --test tests/shop-api.test.cjs
// Exercise actual route code with isolated Supabase/provider boundaries.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { createHmac, webcrypto } = require('node:crypto')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, overrides = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports, require: name => name in overrides ? overrides[name] : require(name),
    Buffer, AbortSignal, crypto: webcrypto, ...globals,
  }, { filename: file })
  return exports
}

function fixture(options = {}) {
  const calls = { grants: [], inserts: [], provider: [] }
  const order = { id: 'order_test', user_id: 'user-a', amount: 9900, currency: 'INR', cosmetic_id: 'midnight-felt' }
  const admin = {
    auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'user-a' } : null }, error: null }) },
    from(table) {
      const filters = {}
      const query = {
        select: () => query, eq: (key, value) => { filters[key] = value; return query },
        single: async () => ({ data: table === 'cosmetics' ? { id: 'midnight-felt', price_paise: 9900 } : options.foreignOrder || filters.user_id !== order.user_id ? null : order, error: null }),
        maybeSingle: async () => ({ error: options.lookupError ? new Error('lookup_failed') : null, data: table === 'shop_orders' ? (options.foreignOrder || filters.id !== order.id ? null : order) : options.owned ? { cosmetic_id: order.cosmetic_id } : null }),
        insert: async row => { calls.inserts.push(row); return { error: null } },
      }
      return query
    },
    rpc: async (name, args) => { calls.grants.push({ name, args }); return { error: options.grantError ? new Error('grant_failed') : null } },
  }
  const env = options.unconfigured ? {} : { RAZORPAY_WEBHOOK_SECRET: options.missingWebhookSecret ? '' : 'webhook-secret', RAZORPAY_KEY_ID: 'test-key', RAZORPAY_KEY_SECRET: 'test-secret', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service' }
  const server = load('lib/shop-server.ts', { 'server-only': {}, '@supabase/supabase-js': { createClient: () => admin } }, {
    process: { env }, fetch: async (url, init) => {
      calls.provider.push({ url, init })
      return { ok: true, json: async () => url.endsWith('/orders') ? { id: order.id, amount: 9900, currency: 'INR' } : {
        id: 'pay_test', order_id: order.id, amount: 9900, currency: 'INR', status: 'captured', captured: true, ...options.payment,
      } }
    },
  })
  const create = load('app/api/shop/create-order/route.ts', { '@/lib/shop-server': server }, { process: { env } })
  const verify = load('app/api/shop/verify/route.ts', { '@/lib/shop-server': server })
  const proof = { razorpay_order_id: order.id, razorpay_payment_id: 'pay_test', razorpay_signature: createHmac('sha256', 'test-secret').update(`${order.id}|pay_test`).digest('hex') }
  const request = (body, token = 'valid') => new Request('http://localhost/api/shop', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const webhook = load('app/api/shop/webhook/route.ts', { '@/lib/shop-server': server }, { process: { env } })
  const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_test', order_id: order.id, amount: 9900, currency: 'INR', status: 'captured', captured: true, ...options.payment } } } }
  const webhookRequest = (raw = JSON.stringify(event), signature = createHmac('sha256', 'webhook-secret').update(raw).digest('hex')) => new Request('http://localhost/api/shop/webhook', { method: 'POST', body: raw, headers: { 'X-Razorpay-Signature': signature } })
  return { create, verify, webhook, webhookRequest, event, proof, request, calls }
}

test('missing keys return the exact 503 contract without touching provider', async () => {
  const f = fixture({ unconfigured: true })
  for (const response of [await f.create.GET(), await f.create.POST(f.request({})), await f.verify.POST(f.request({}))]) {
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'payments_unconfigured' })
  }
  assert.equal(f.calls.provider.length, 0)
})
test('shop API responses are reachable without cookie-session configuration', async () => {
  let refreshes = 0
  const { middleware } = load('middleware.ts', {
    '@supabase/auth-helpers-nextjs': { createMiddlewareClient: () => {
      refreshes++
      return { auth: { getSession: async () => ({}) } }
    } },
  })
  await middleware({ nextUrl: { pathname: '/api/shop/create-order' } })
  await middleware({ nextUrl: { pathname: '/api/shop/verify' } })
  await middleware({ nextUrl: { pathname: '/api/shop/webhook' } })
  assert.equal(refreshes, 0)
  await middleware({ nextUrl: { pathname: '/dashboard/shop' } })
  assert.equal(refreshes, 1)
})
test('both routes require a validated Supabase user', async () => {
  const f = fixture()
  assert.equal((await f.create.POST(f.request({ itemId: 'midnight-felt' }, 'invalid'))).status, 401)
  assert.equal((await f.verify.POST(f.request(f.proof, 'invalid'))).status, 401)
  assert.equal(f.calls.provider.length, 0)
})
test('order creation uses database price and authenticated owner, ignoring client overrides', async () => {
  const f = fixture()
  const response = await f.create.POST(f.request({ itemId: 'midnight-felt', amount: 1, currency: 'USD', user_id: 'attacker' }))
  assert.equal(response.status, 200)
  const sent = JSON.parse(f.calls.provider[0].init.body)
  assert.equal(sent.amount, 9900)
  assert.equal(sent.currency, 'INR')
  assert.equal(f.calls.inserts[0].user_id, 'user-a')
  assert.equal(f.calls.inserts[0].amount, 9900)
})
test('owned items cannot start another order', async () => {
  const f = fixture({ owned: true })
  assert.equal((await f.create.POST(f.request({ itemId: 'midnight-felt' }))).status, 409)
  assert.equal(f.calls.provider.length, 0)
})
test('another user cannot verify an order', async () => {
  const f = fixture({ foreignOrder: true })
  assert.equal((await f.verify.POST(f.request(f.proof))).status, 404)
  assert.equal(f.calls.grants.length, 0)
})
test('forged and malformed signatures never reach payment lookup or grants', async () => {
  for (const signature of ['0'.repeat(64), 'nope', 'f'.repeat(63)]) {
    const f = fixture()
    assert.equal((await f.verify.POST(f.request({ ...f.proof, razorpay_signature: signature }))).status, 400)
    assert.equal(f.calls.provider.length, 0)
    assert.equal(f.calls.grants.length, 0)
  }
})
test('amount, currency, payment ID and order mismatches cannot grant items', async () => {
  for (const payment of [{ amount: 1 }, { currency: 'USD' }, { order_id: 'order_other' }, { id: 'pay_other' }]) {
    const f = fixture({ payment })
    assert.equal((await f.verify.POST(f.request(f.proof))).status, 400)
    assert.equal(f.calls.grants.length, 0)
  }
})
test('authorized or refunded payments do not grant items', async () => {
  for (const payment of [{ status: 'authorized', captured: false }, { status: 'refunded' }, { captured: false }]) {
    const f = fixture({ payment })
    assert.equal((await f.verify.POST(f.request(f.proof))).status, 409)
    assert.equal(f.calls.grants.length, 0)
  }
})
test('valid captured payment fulfills only the stored order, ignoring client item/user', async () => {
  const f = fixture()
  const response = await f.verify.POST(f.request({ ...f.proof, itemId: 'gold-token', user_id: 'attacker' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, itemId: 'midnight-felt' })
  assert.equal(f.calls.grants.length, 1)
  assert.equal(f.calls.grants[0].name, 'fulfill_shop_order')
  assert.equal(f.calls.grants[0].args.p_order_id, 'order_test')
  assert.equal(f.calls.grants[0].args.p_payment_id, 'pay_test')
})


test('webhook fails closed without keys or its separate secret', async () => {
  for (const options of [{ unconfigured: true }, { missingWebhookSecret: true }]) {
    const f = fixture(options)
    const response = await f.webhook.POST(f.webhookRequest())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'payments_unconfigured' })
    assert.equal(f.calls.grants.length, 0)
  }
})

test('webhook authenticates exact raw bytes before parsing', async () => {
  const f = fixture()
  for (const signature of ['', 'nope', '0'.repeat(64)]) {
    assert.equal((await f.webhook.POST(f.webhookRequest('not json', signature))).status, 400)
  }
  const raw = JSON.stringify(f.event, null, 2)
  const signature = createHmac('sha256', 'webhook-secret').update(raw).digest('hex')
  assert.equal((await f.webhook.POST(f.webhookRequest(raw + ' ', signature))).status, 400)
  assert.equal(f.calls.grants.length, 0)
  assert.equal((await f.webhook.POST(f.webhookRequest(raw, signature))).status, 200)
})

test('signed invalid payloads and unrelated events never grant', async () => {
  const f = fixture()
  for (const raw of ['not json', 'null', '{}', '{"event":"payment.captured"}']) {
    assert.equal((await f.webhook.POST(f.webhookRequest(raw))).status, 400)
  }
  assert.equal((await f.webhook.POST(f.webhookRequest('{"event":"payment.authorized"}'))).status, 200)
  assert.equal(f.calls.grants.length, 0)
})

test('webhook rejects unknown orders and mismatched or uncaptured payments', async () => {
  for (const [options, status] of [
    [{ foreignOrder: true }, 404], [{ payment: { order_id: 'order_other' } }, 404], [{ payment: { amount: 1 } }, 400],
    [{ payment: { currency: 'USD' } }, 400], [{ payment: { id: '' } }, 400],
    [{ payment: { status: 'authorized' } }, 409], [{ payment: { captured: false } }, 409],
    [{ lookupError: true }, 502], [{ grantError: true }, 502],
  ]) {
    const f = fixture(options)
    assert.equal((await f.webhook.POST(f.webhookRequest())).status, status)
    if (!options.grantError) assert.equal(f.calls.grants.length, 0)
  }
})

test('webhook retries and checkout verification use the same atomic fulfillment', async () => {
  const f = fixture()
  assert.equal((await f.verify.POST(f.request(f.proof))).status, 200)
  for (let i = 0; i < 2; i++) {
    assert.equal((await f.webhook.POST(f.webhookRequest())).status, 200)
  }
  assert.equal(f.calls.grants.length, 3)
  for (const grant of f.calls.grants) {
    assert.equal(grant.name, 'fulfill_shop_order')
    assert.equal(grant.args.p_order_id, 'order_test')
    assert.equal(grant.args.p_payment_id, 'pay_test')
  }
})
