ALTER TABLE "organization_memberships" ADD COLUMN "workos_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "workos_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "workos_updated_at" timestamp with time zone;