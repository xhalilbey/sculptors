-- Custom migration: what the app role may touch. The role itself is created
-- once per Neon project by db/bootstrap-roles.sql (its password never enters
-- git); grants are migrations so every branch and every PGlite test database
-- ends up with the same privileges.
--
-- Data privileges only: no CREATE, no TRUNCATE, no ownership, and nothing on
-- schema `drizzle`, where the migration bookkeeping lives. Row level security
-- still decides which rows each statement sees.
grant usage on schema public to sculptors_app;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to sculptors_app;
--> statement-breakpoint
grant usage, select on all sequences in schema public to sculptors_app;
--> statement-breakpoint
-- Without FOR ROLE these apply to the role running the migration (the owner on
-- Neon, the superuser in PGlite), which is the role that creates every future
-- table. A new tenant table therefore needs only its tenantPolicy().
alter default privileges in schema public grant select, insert, update, delete on tables to sculptors_app;
--> statement-breakpoint
alter default privileges in schema public grant usage, select on sequences to sculptors_app;
