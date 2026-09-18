-- HOST HANDOFF: let the current host move `parties.created_by` to another
-- seated member, and nobody else.
--
-- Why this is needed:
--   The existing "parties_update" policy has no WITH CHECK, so Postgres reuses
--   the USING expression for the new row. A host who has no `party_members`
--   row (parties created before the member row was written, or where that
--   insert failed) therefore cannot hand the party over: the updated row names
--   somebody else as created_by and the check fails. The WITH CHECK below also
--   accepts a row whose new host is a seated member.
--
--   That alone would let ANY member rewrite created_by and take the party, so
--   the trigger keeps the change itself locked to the current host.
--
-- Apply this in the Supabase dashboard, then smoke-test: as host, pass the
-- host to another member; as that member, confirm the host controls appear;
-- as the old host, confirm they are now an ordinary member.

DROP POLICY IF EXISTS "parties_update" ON parties;
CREATE POLICY "parties_update" ON parties FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() IN (SELECT user_id FROM party_members WHERE party_id = parties.id)
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() IN (SELECT user_id FROM party_members WHERE party_id = parties.id)
    -- handing over: the new host must be someone seated in this party
    OR created_by IN (SELECT user_id FROM party_members WHERE party_id = parties.id)
  );

CREATE OR REPLACE FUNCTION public.enforce_party_host_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    -- auth.uid() is NULL for trusted server-side keys; only gate real users.
    IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.created_by THEN
      RAISE EXCEPTION 'Only the current host can pass the host role';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM party_members
      WHERE party_id = NEW.id AND user_id = NEW.created_by
    ) THEN
      RAISE EXCEPTION 'The new host must be a member of the party';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parties_host_handoff_guard ON parties;
CREATE TRIGGER parties_host_handoff_guard
  BEFORE UPDATE ON parties
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_party_host_handoff();
