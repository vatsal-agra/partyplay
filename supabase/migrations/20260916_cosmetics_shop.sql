-- Cosmetic ownership is writable only through restricted functions or the server.
BEGIN;
CREATE TABLE public.cosmetics (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('felt', 'token', 'card_back', 'flair')),
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  starter boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  preview_color text NOT NULL,
  CHECK (NOT starter OR price_paise = 0),
  UNIQUE (id, category)
);
CREATE TABLE public.user_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id text NOT NULL,
  category text NOT NULL,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id),
  FOREIGN KEY (cosmetic_id, category) REFERENCES public.cosmetics(id, category)
);
CREATE UNIQUE INDEX one_equipped_cosmetic_per_category
  ON public.user_cosmetics(user_id, category) WHERE equipped;
CREATE TABLE public.coin_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  reason text NOT NULL,
  reference text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_orders (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id text NOT NULL REFERENCES public.cosmetics(id),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_id text UNIQUE,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cosmetics, public.user_cosmetics, public.coin_ledger, public.shop_orders FROM anon, authenticated;
GRANT SELECT ON public.cosmetics TO anon, authenticated;
GRANT SELECT ON public.user_cosmetics, public.coin_ledger, public.shop_orders TO authenticated;
GRANT ALL ON public.cosmetics, public.user_cosmetics, public.coin_ledger, public.shop_orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.coin_ledger_id_seq TO service_role;
CREATE POLICY catalog_read ON public.cosmetics FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY ownership_read ON public.user_cosmetics FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ledger_read ON public.coin_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY orders_read ON public.shop_orders FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.cosmetics (id, name, description, category, price_paise, starter, preview_color) VALUES
 ('starter-felt', 'Alley Green', 'The classic green felt. Your first table signature.', 'felt', 0, true, '#145c48'),
 ('starter-token', 'Ivory Dice', 'A clean ivory token for your collection.', 'token', 0, true, '#f0e5ca'),
 ('midnight-felt', 'Midnight Felt Pack', 'Deep midnight blue with a quiet gold glow.', 'felt', 9900, false, '#182747'),
 ('gold-token', 'Gold Token Pack', 'A warm gold finish for your token collection.', 'token', 7900, false, '#d4a843'),
 ('royal-cards', 'Royal Card Back Pack', 'Rich plum and gold for your card collection.', 'card_back', 7900, false, '#693b70'),
 ('gold-flair', 'Golden Hour Flair Pack', 'A golden signature for your player collection.', 'flair', 4900, false, '#e8b85b');

CREATE FUNCTION public.unlock_starter_cosmetics() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, category)
    SELECT auth.uid(), id, category FROM public.cosmetics
    WHERE starter AND price_paise = 0 AND active
    ON CONFLICT (user_id, cosmetic_id) DO NOTHING;
END;
$$;
CREATE FUNCTION public.equip_cosmetic(p_cosmetic_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected_category text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  -- Serialize equips for this user, including simultaneous requests in different tabs.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  SELECT category INTO selected_category FROM public.user_cosmetics
    WHERE user_id = auth.uid() AND cosmetic_id = p_cosmetic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cosmetic_not_owned'; END IF;
  UPDATE public.user_cosmetics SET equipped = false
    WHERE user_id = auth.uid() AND category = selected_category AND equipped;
  UPDATE public.user_cosmetics SET equipped = true
    WHERE user_id = auth.uid() AND cosmetic_id = p_cosmetic_id;
END;
$$;
-- Only the backend may call this after checking Razorpay's signature and capture.
-- Locking plus the unique payment ID makes retries safe and grants atomic.
CREATE FUNCTION public.fulfill_shop_order(p_order_id text, p_payment_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE purchase public.shop_orders%ROWTYPE;
BEGIN
  SELECT * INTO purchase FROM public.shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF purchase.fulfilled_at IS NOT NULL THEN
    IF purchase.payment_id <> p_payment_id THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
    RETURN;
  END IF;
  INSERT INTO public.user_cosmetics(user_id, cosmetic_id, category)
    SELECT purchase.user_id, id, category FROM public.cosmetics WHERE id = purchase.cosmetic_id
    ON CONFLICT (user_id, cosmetic_id) DO NOTHING;
  UPDATE public.shop_orders SET payment_id = p_payment_id, fulfilled_at = now() WHERE id = p_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.unlock_starter_cosmetics(), public.equip_cosmetic(text), public.fulfill_shop_order(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_starter_cosmetics(), public.equip_cosmetic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_shop_order(text, text) TO service_role;
COMMIT;
