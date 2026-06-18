-- SECURITY: Row-Level Security for the core tables.
--
-- The Supabase anon key ships in every browser, so RLS is the ONLY thing
-- stopping anyone from calling the REST API directly to read or delete data.
-- These policies enable RLS and allow exactly what the app does — no more.
--
-- Apply this, then smoke-test: create a party, join from a second account,
-- vote, chat, launch a game. If anything breaks, it's almost certainly a policy
-- here that's too tight.

-- ===== parties =============================================================
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_select" ON parties;
CREATE POLICY "parties_select" ON parties FOR SELECT
  USING (auth.uid() IS NOT NULL);                       -- any signed-in user (incl. guests) can browse/join

DROP POLICY IF EXISTS "parties_insert" ON parties;
CREATE POLICY "parties_insert" ON parties FOR INSERT
  WITH CHECK (auth.uid() = created_by);                 -- you can only create a party as yourself

DROP POLICY IF EXISTS "parties_update" ON parties;
CREATE POLICY "parties_update" ON parties FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() IN (SELECT user_id FROM party_members WHERE party_id = parties.id)
  );                                                    -- host, or a member (touch last_active_at)

DROP POLICY IF EXISTS "parties_delete" ON parties;
CREATE POLICY "parties_delete" ON parties FOR DELETE
  USING (auth.uid() = created_by);                      -- only the host can delete

-- ===== party_members =======================================================
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "party_members_select" ON party_members;
CREATE POLICY "party_members_select" ON party_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "party_members_insert" ON party_members;
CREATE POLICY "party_members_insert" ON party_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);                    -- you can only add yourself (join)

DROP POLICY IF EXISTS "party_members_update" ON party_members;
CREATE POLICY "party_members_update" ON party_members FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM parties WHERE id = party_members.party_id)
  );                                                    -- yourself, or the host (mute, etc.)

DROP POLICY IF EXISTS "party_members_delete" ON party_members;
CREATE POLICY "party_members_delete" ON party_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM parties WHERE id = party_members.party_id)
  );                                                    -- leave yourself, or host kicks

-- ===== messages ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM party_members WHERE party_id = messages.party_id)
    OR auth.uid() IN (SELECT created_by FROM parties WHERE id = messages.party_id)
  );                                                    -- only people in the party can read its chat

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);                    -- you can only post as yourself

-- ===== votes ===============================================================
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes_select" ON votes;
CREATE POLICY "votes_select" ON votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "votes_write" ON votes;
CREATE POLICY "votes_write" ON votes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);                    -- you can only cast/change/remove your own vote
