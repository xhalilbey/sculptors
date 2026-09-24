-- Custom migration: drizzle-kit's diff cannot see functions or triggers.
-- One trigger function keeps updated_at honest on every mutable table, so no
-- repository has to remember to set it.
create or replace function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
--> statement-breakpoint
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();
