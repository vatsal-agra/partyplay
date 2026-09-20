-- Self-service deletion is one transaction. Any unexpected dependency or
-- trigger failure rolls back the handoff and every deletion.
-- Prerequisites: the deployed party_members/messages schema used by the RLS
-- migration and parties.created_by used by the host handoff migration.
BEGIN;

CREATE FUNCTION public.delete_my_account() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller uuid := auth.uid();
  hosted record;
  successor uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- Serialize party changes and joins during successor selection. These locks
  -- also prevent two deleting hosts from handing parties to each other.
  LOCK TABLE public.parties, public.party_members IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM auth.users WHERE id = caller FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found';
  END IF;

  FOR hosted IN
    SELECT id FROM public.parties WHERE created_by = caller ORDER BY id
  LOOP
    SELECT m.user_id INTO successor
    FROM public.party_members AS m
    JOIN auth.users AS u ON u.id = m.user_id
    WHERE m.party_id = hosted.id AND m.user_id <> caller
    ORDER BY m.joined_at NULLS FIRST, m.id
    LIMIT 1;

    IF successor IS NOT NULL THEN
      UPDATE public.party_members SET role = 'leader'
        WHERE party_id = hosted.id AND user_id = successor;
      -- The existing handoff trigger checks the caller is the old host and
      -- the successor is still seated. Do not bypass that guard.
      UPDATE public.parties SET created_by = successor WHERE id = hosted.id;
    ELSE
      DELETE FROM public.messages WHERE party_id = hosted.id;
      DELETE FROM public.votes WHERE party_id = hosted.id;
      DELETE FROM public.party_members WHERE party_id = hosted.id;
      DELETE FROM public.parties WHERE id = hosted.id;
    END IF;
  END LOOP;

  -- The initial schema used host_id. Some deployed schemas retain this
  -- nullable legacy reference alongside the authoritative created_by column.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.parties'::pg_catalog.regclass
      AND attname = 'host_id' AND NOT attisdropped
  ) THEN
    EXECUTE 'UPDATE public.parties SET host_id = created_by WHERE host_id = $1'
      USING caller;
  END IF;

  DELETE FROM public.messages WHERE user_id = caller;
  DELETE FROM public.votes WHERE user_id = caller;
  DELETE FROM public.party_members WHERE user_id = caller;
  -- Cascades defined by existing migrations remove profiles, game_stats,
  -- user_achievements, user_cosmetics, coin_ledger and shop_orders.
  DELETE FROM auth.users WHERE id = caller;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
COMMIT;
