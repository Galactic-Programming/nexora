-- Follow-up to 20260612083000: revoking EXECUTE from anon/authenticated was
-- not enough — Postgres grants EXECUTE on functions to PUBLIC by default
-- (proacl showed `=X/postgres`), and anon/authenticated inherit through it.
-- Revoke from PUBLIC; postgres (owner) and service_role keep their explicit
-- grants, which is all the trigger helper needs.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
