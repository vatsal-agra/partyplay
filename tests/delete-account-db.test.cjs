// Run with an external @electric-sql/pglite install on NODE_PATH.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const sql = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8')
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

for (const legacyHost of [true, false]) {
  test(`deletion authorization, handoff, cleanup and rollback (legacy host_id: ${legacyHost})`, async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      `)
      await db.exec(sql('20250521_create_tables')
        .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
        .replaceAll('uuid_generate_v4()', 'gen_random_uuid()'))
      await db.exec(sql('20250525_add_profiles_table'))
      // These definitions are absent from repository migrations. Model the
      // columns used by existing RLS/app code with restrictive FKs, so the
      // deletion test cannot accidentally rely on undocumented cascades.
      await db.exec(`
        ALTER TABLE public.parties ADD COLUMN created_by uuid REFERENCES auth.users(id);
        CREATE TABLE public.party_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          party_id uuid REFERENCES public.parties(id),
          user_id uuid REFERENCES auth.users(id), role text, joined_at timestamptz
        );
        CREATE TABLE public.messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          party_id uuid REFERENCES public.parties(id), user_id uuid REFERENCES auth.users(id)
        );
      `)
      if (!legacyHost) await db.exec('ALTER TABLE public.parties DROP COLUMN host_id')
      if (!legacyHost) await db.exec(sql('20260613_game_voting')
        .replace('ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;', ''))
      for (const name of ['20260616_game_stats', '20260617_reconnect_achievements',
        '20260618_progression_flair', '20260620_security_rls',
        '20260916_cosmetics_shop', '20260919_host_handoff', '20260920_delete_account']) {
        await db.exec(sql(name))
      }
      // Exercise restrictive original vote FKs as well as the current cascade
      // schema. Supply required game labels only for the current schema.
      await db.exec(`
        INSERT INTO auth.users VALUES
          ('${uid(1)}', '{"username":"one"}'),
          ('${uid(2)}', '{"username":"two"}'),
          ('${uid(3)}', '{"username":"three"}');
        INSERT INTO public.parties(id,name,max_players,created_by) VALUES
          ('${uid(11)}','Shared',4,'${uid(1)}'),
          ('${uid(12)}','Empty',4,'${uid(1)}'),
          ('${uid(13)}','Other host',4,'${uid(3)}');
        INSERT INTO public.party_members(party_id,user_id,role,joined_at) VALUES
          ('${uid(11)}','${uid(1)}','leader','2026-01-01'),
          ('${uid(11)}','${uid(2)}','member','2026-01-02'),
          ('${uid(11)}','${uid(3)}','member','2026-01-03'),
          ('${uid(13)}','${uid(1)}','member','2026-01-01');
        INSERT INTO public.messages(party_id,user_id) VALUES
          ('${uid(11)}','${uid(1)}'), ('${uid(11)}','${uid(2)}'), ('${uid(12)}','${uid(2)}');
        INSERT INTO public.votes(party_id,user_id${legacyHost ? '' : ',game_id,game_name'}) VALUES
          ('${uid(11)}','${uid(1)}'${legacyHost ? '' : ", 'uno', 'Uno'"}),
          ('${uid(12)}','${uid(2)}'${legacyHost ? '' : ", 'uno', 'Uno'"});
        INSERT INTO public.game_stats(user_id) VALUES ('${uid(1)}'), ('${uid(2)}');
        INSERT INTO public.user_achievements(user_id,achievement_id) VALUES ('${uid(1)}','first');
        INSERT INTO public.user_cosmetics(user_id,cosmetic_id,category) VALUES ('${uid(1)}','gold-token','token');
        INSERT INTO public.coin_ledger(user_id,amount,reason,reference) VALUES ('${uid(1)}',1,'test','test');
        INSERT INTO public.shop_orders(id,user_id,cosmetic_id,amount) VALUES ('order','${uid(1)}','gold-token',7900);
        CREATE TABLE public.unhandled_dependency(user_id uuid REFERENCES auth.users(id));
        INSERT INTO public.unhandled_dependency VALUES ('${uid(1)}');
      `)
      if (legacyHost) await db.exec(`UPDATE public.parties SET host_id = '${uid(1)}'`)
      await db.exec('SET ROLE anon')
      await assert.rejects(db.query('SELECT public.delete_my_account()'), /permission denied/)
      await db.exec('RESET ROLE; SET ROLE authenticated')
      await assert.rejects(db.query('SELECT public.delete_my_account()'), /authentication_required/)
      await db.exec(`SET request.jwt.claim.sub = '${uid(1)}'`)
      await assert.rejects(db.query(`SELECT public.delete_my_account('${uid(2)}'::uuid)`), /does not exist/)
      await assert.rejects(db.query('SELECT public.delete_my_account()'), /foreign key constraint/)
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT * FROM auth.users')).rows.length, 3)
      assert.equal((await db.query('SELECT * FROM public.parties')).rows.length, 3)
      assert.equal((await db.query(`SELECT created_by FROM public.parties WHERE id='${uid(11)}'`)).rows[0].created_by, uid(1))
      assert.equal((await db.query('SELECT * FROM public.messages')).rows.length, 3)
      assert.equal((await db.query('SELECT * FROM public.user_cosmetics')).rows.length, 1)
      await db.exec(`DELETE FROM public.unhandled_dependency; SET ROLE authenticated`)
      assert.equal((await db.query('SELECT public.delete_my_account() AS deleted')).rows[0].deleted, true)
      await assert.rejects(db.query('SELECT public.delete_my_account()'), /account_not_found/)
      await db.exec('RESET ROLE')
      assert.deepEqual((await db.query('SELECT id FROM auth.users ORDER BY id')).rows.map(r => r.id), [uid(2), uid(3)])
      assert.deepEqual((await db.query('SELECT id,created_by FROM public.parties ORDER BY id')).rows, [
        { id: uid(11), created_by: uid(2) }, { id: uid(13), created_by: uid(3) },
      ])
      if (legacyHost) assert.equal((await db.query(`SELECT * FROM public.parties WHERE host_id='${uid(1)}'`)).rows.length, 0)
      assert.equal((await db.query(`SELECT role FROM public.party_members WHERE user_id='${uid(2)}'`)).rows[0].role, 'leader')
      assert.equal((await db.query('SELECT * FROM public.messages')).rows.length, 1)
      assert.equal((await db.query('SELECT * FROM public.profiles')).rows.length, 2)
      assert.equal((await db.query('SELECT * FROM public.game_stats')).rows.length, 1)
      for (const table of ['party_members', 'votes', 'messages', 'game_stats', 'user_achievements', 'user_cosmetics', 'coin_ledger', 'shop_orders']) {
        assert.equal((await db.query(`SELECT * FROM public.${table} WHERE user_id='${uid(1)}'`)).rows.length, 0, table)
      }
    } finally { await db.close() }
  })
}
