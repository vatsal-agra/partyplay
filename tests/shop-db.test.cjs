// Run: node --test tests/shop-db.test.cjs
// Requires an external PGlite install via NODE_PATH; no app dependency is added.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

test('shop migration enforces ownership, RLS, function permissions and idempotent fulfillment', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
    `)
    await db.exec(readFileSync('supabase/migrations/20260916_cosmetics_shop.sql', 'utf8'))
    await db.exec(`SET ROLE anon`)
    assert.equal((await db.query('SELECT * FROM public.cosmetics')).rows.length, 6)
    await assert.rejects(db.query('SELECT public.unlock_starter_cosmetics()'), /permission denied/)
    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001'`)
    await db.query('SELECT public.unlock_starter_cosmetics()')
    await db.query('SELECT public.unlock_starter_cosmetics()')
    assert.equal((await db.query('SELECT * FROM public.user_cosmetics')).rows.length, 2)
    await assert.rejects(db.query(`INSERT INTO public.user_cosmetics(user_id, cosmetic_id, category) VALUES (auth.uid(), 'gold-token', 'token')`), /permission denied/)
    await assert.rejects(db.query(`UPDATE public.user_cosmetics SET cosmetic_id = 'gold-token'`), /permission denied/)
    await assert.rejects(db.query(`INSERT INTO public.coin_ledger(user_id, amount, reason, reference) VALUES (auth.uid(), 999, 'forged', 'forged')`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.fulfill_shop_order('order_test', 'pay_test')`), /permission denied/)
    await assert.rejects(db.query(`SELECT public.equip_cosmetic('gold-token')`), /cosmetic_not_owned/)
    await db.query(`SELECT public.equip_cosmetic('starter-felt')`)
    assert.equal((await db.query(`SELECT equipped FROM public.user_cosmetics WHERE cosmetic_id = 'starter-felt'`)).rows[0].equipped, true)
    await db.exec(`SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002'`)
    assert.equal((await db.query('SELECT * FROM public.user_cosmetics')).rows.length, 0)
    await assert.rejects(db.query(`SELECT public.equip_cosmetic('starter-felt')`), /cosmetic_not_owned/)
    await db.exec(`RESET ROLE; SET ROLE service_role`)
    await db.query(`INSERT INTO public.shop_orders(id,user_id,cosmetic_id,amount) VALUES ('order_test','00000000-0000-0000-0000-000000000001','midnight-felt',9900)`)
    await db.query(`SELECT public.fulfill_shop_order('order_test', 'pay_test')`)
    await db.query(`SELECT public.fulfill_shop_order('order_test', 'pay_test')`)
    assert.equal((await db.query(`SELECT * FROM public.user_cosmetics WHERE cosmetic_id = 'midnight-felt'`)).rows.length, 1)
    await assert.rejects(db.query(`SELECT public.fulfill_shop_order('order_test', 'pay_other')`), /payment_mismatch/)
    await db.query(`INSERT INTO public.shop_orders(id,user_id,cosmetic_id,amount) VALUES ('order_second','00000000-0000-0000-0000-000000000002','gold-token',7900)`)
    await assert.rejects(db.query(`SELECT public.fulfill_shop_order('order_second', 'pay_test')`), /unique constraint/)
    assert.equal((await db.query(`SELECT * FROM public.user_cosmetics WHERE cosmetic_id = 'gold-token'`)).rows.length, 0, 'failed grant transaction rolls back ownership')
    await db.query(`INSERT INTO public.coin_ledger(user_id, amount, reason, reference) VALUES ('00000000-0000-0000-0000-000000000001', 10, 'trusted award', 'award-1')`)
    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002'`)
    assert.equal((await db.query('SELECT * FROM public.shop_orders')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM public.coin_ledger')).rows.length, 0)
    await db.exec(`SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001'`)
    await db.query(`SELECT public.equip_cosmetic('midnight-felt')`)
    const equipped = (await db.query(`SELECT cosmetic_id FROM public.user_cosmetics WHERE equipped`)).rows
    assert.deepEqual(equipped, [{ cosmetic_id: 'midnight-felt' }])
    assert.equal((await db.query('SELECT * FROM public.coin_ledger')).rows.length, 1)
    await db.exec(`SET request.jwt.claim.sub = ''`)
    await assert.rejects(db.query(`SELECT public.unlock_starter_cosmetics()`), /authentication_required/)
  } finally { await db.close() }
})
