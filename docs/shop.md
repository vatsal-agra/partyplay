# Cosmetic shop deployment

Apply `supabase/migrations/20260916_cosmetics_shop.sql` to the project's Supabase database before opening the shop. It seeds two free starters and four paid cosmetic packs. Equip persists one owned item per category; this slice does not change game engines or render equipped cosmetics in games.

Server environment (never commit real values):

- Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` for server-only order storage and verified grants. Never use a `NEXT_PUBLIC_` prefix for this key.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from the same Razorpay account/mode.
- `RAZORPAY_WEBHOOK_SECRET`, matching the secret configured for this endpoint in the Razorpay dashboard (separate from the API key secret).

Without Razorpay keys, the order API returns HTTP 503 with `{"error":"payments_unconfigured"}` and paid buttons show “Payments coming online”. Free unlocks and equip require only Supabase and the migration. Without the service-role key, order creation fails closed with `shop_unconfigured`.

Enable automatic capture in Razorpay. The server checks the authenticated user, stored order, HMAC signature, fetched payment ID, order ID, amount, INR currency and captured status before invoking the service-only atomic fulfillment function. Prices and entitlements never come from checkout input. A proof saved in browser storage lets a signed-in user retry verification after a reload or delayed capture; it cannot authorize a grant without server verification. Fulfillment retries do not duplicate entitlements. Configure a Razorpay webhook at `https://<your-domain>/api/shop/webhook` and subscribe to `payment.captured` so fulfillment completes even if the checkout tab closes before browser verification. The endpoint verifies `X-Razorpay-Signature` against the exact raw body with `RAZORPAY_WEBHOOK_SECRET` before parsing any event. It matches the payment order ID, amount, currency and captured status against the stored shop order, then calls the same atomic `fulfill_shop_order` function. Duplicate deliveries and races with browser verification are safe. Signed unrelated events return 200 without fulfillment. Missing Razorpay keys or webhook secret returns HTTP 503 with `{"error":"payments_unconfigured"}`. Unknown orders and storage/fulfillment failures return non-2xx so delivery can be retried; monitor failed deliveries in the provider dashboard.

The coin ledger is reserved for trusted server awards and spending. Clients can only read their own entries. Gameplay coin awards, coin purchases and coin redemption are not wired up in this slice; existing game results are client-reported and are not sufficient proof for economic awards.

Before enabling live payments, test with Razorpay test keys: purchase, cancel, failed payment, delayed capture/retry, duplicate verification, signed webhook delivery after closing checkout, duplicate webhook delivery, invalid/missing webhook signatures, missing webhook secret, another user's order, tampered signature/amount and missing keys. Verify starter unlocks are idempotent and equips survive reload. Keep keys in deployment environment settings only.

Provider reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

Webhook signature reference: https://razorpay.com/docs/webhooks/validate-test/

## Local checks

`npm run build` and `node --test tests/shop-api.test.cjs` use existing dependencies. Route tests isolate Supabase and Razorpay boundaries while exercising the actual route implementations.

The database regression test runs the migration in PGlite (PostgreSQL compiled to WASM). Install it outside the worktree so it does not become an application dependency, then expose that temporary install via `NODE_PATH`. PowerShell example:

```powershell
npm install --prefix "$env:TEMP/dice-shop-sql-check" --no-audit --no-fund @electric-sql/pglite
$env:NODE_PATH = "$env:TEMP/dice-shop-sql-check/node_modules"
node --test tests/shop-api.test.cjs tests/shop-db.test.cjs
```

This checks the migration against stubbed Supabase roles/auth, including denied paid grants, own-row reads, starter retries, equip switching, payment replay and transaction rollback. It does not replace a staging Supabase/Razorpay test.
