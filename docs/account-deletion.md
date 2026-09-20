# Account deletion

The dashboard player card opens a keyboard-accessible confirmation dialog.
Confirming calls `public.delete_my_account()` without a user ID parameter.
Only an explicit `true` result proceeds to local sign out and navigation home.
Deletion errors remain visible in the dialog. A sign-out failure after deletion
offers a sign-out retry without repeating deletion.

The migration is not applied automatically. Deploy
`supabase/migrations/20260920_delete_account.sql` through the normal database
migration process before using the control. If the RPC is unavailable, the UI
reports failure and does not report successful deletion.

The RPC obtains the caller from `auth.uid()`, rejects missing users, pins its
search path, and grants execute only to `authenticated` (apart from the owner).
Party writes are briefly serialized while the oldest remaining member receives
host ownership. Empty hosted parties and their messages, votes and memberships
are removed. The caller's messages, votes and memberships are removed everywhere.
Deleting the auth user cascades to the profile, stats, achievements and shop rows
according to existing migrations. Unhandled constraints fail the whole operation;
there is no partial-success exception handler.

## Schema and verification limits

The repository references `party_members`, `messages` and `parties.created_by`
in RLS and host handoff code but does not contain their original schema changes.
The local database tests model those documented columns with restrictive foreign
keys and execute the existing profile, stats, achievements, shop, RLS and handoff
migrations. They cover both legacy `host_id` and its absence, original restrictive
votes and current cascading votes, caller-only authorization, preserved users,
party succession, dependent cleanup and rollback on an unexpected dependency.
They do not certify untracked production triggers or constraints. Review those
before deployment. No live Supabase migration or account deletion was performed.

Run client tests with `node --test tests/delete-account.test.cjs`. Database tests
use `node --test tests/delete-account-db.test.cjs` with an external
`@electric-sql/pglite` installation available through `NODE_PATH`, following the
existing shop database test convention. Run `npx tsc --noEmit --incremental false`
for type checking.
