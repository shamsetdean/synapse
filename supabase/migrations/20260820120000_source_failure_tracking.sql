alter table public.user_sources
  add column if not exists consecutive_failures integer not null default 0;

comment on column public.user_sources.consecutive_failures is
  'Nombre d''echecs de synchronisation consecutifs ; remis a zero des qu''une synchronisation reussit.';
