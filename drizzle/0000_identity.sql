CREATE TABLE "organization_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_org_user_key" UNIQUE("organization_id","user_id"),
	CONSTRAINT "organization_memberships_id_check" CHECK ("organization_memberships"."id" like 'om\_%' escape '\'),
	CONSTRAINT "organization_memberships_status_check" CHECK ("organization_memberships"."status" in ('active', 'inactive', 'pending'))
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"region" text DEFAULT 'eu-central-1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"category" text,
	"onboarding_completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_id_check" CHECK ("organizations"."id" like 'org\_%' escape '\'),
	CONSTRAINT "organizations_name_check" CHECK (char_length("organizations"."name") between 1 and 100),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" in ('active', 'suspended', 'deleted')),
	CONSTRAINT "organizations_category_check" CHECK ("organizations"."category" is null or "organizations"."category" in ('ecommerce'))
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_workos_user_id_key" UNIQUE("workos_user_id"),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active', 'inactive', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workos_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "workos_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id") WHERE "organization_memberships"."status" = 'active';--> statement-breakpoint
CREATE INDEX "organization_memberships_org_idx" ON "organization_memberships" USING btree ("organization_id") WHERE "organization_memberships"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "workos_webhook_events_unprocessed_idx" ON "workos_webhook_events" USING btree ("received_at") WHERE "workos_webhook_events"."processed_at" is null;--> statement-breakpoint
CREATE POLICY "organization_memberships_app_all" ON "organization_memberships" AS PERMISSIVE FOR ALL TO "sculptors_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "organizations_app_all" ON "organizations" AS PERMISSIVE FOR ALL TO "sculptors_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "users_app_all" ON "users" AS PERMISSIVE FOR ALL TO "sculptors_app" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "workos_webhook_events_app_all" ON "workos_webhook_events" AS PERMISSIVE FOR ALL TO "sculptors_app" USING (true) WITH CHECK (true);