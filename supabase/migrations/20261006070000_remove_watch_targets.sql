-- Monitoring targets are now derived from the Cartesian product of
-- active products and active stores. The explicit watch target table is
-- no longer part of the application model.
drop table if exists public.watch_targets;
