/**
 * Centralized Validation Schemas
 *
 * The request schemas the pages and routes share: the login form's (the
 * login page and the password route), the organization id in a path or
 * body, and the organization name the create and rename routes accept. The
 * browser's response parsers are imported from organizations.schema.ts
 * directly.
 */

export { loginSchema, type LoginInput } from './auth.schema';
export { organizationIdSchema } from './ids.schema';
export { organizationNameSchema } from './organizations.schema';
