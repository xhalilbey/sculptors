/**
 * Centralized Validation Schemas
 *
 * The login form's schema, exported from one place for the login page and
 * any route that validates the same fields.
 */

export { loginSchema, type LoginInput } from './auth.schema';
export { organizationIdSchema } from './ids.schema';
export { organizationNameSchema } from './organizations.schema';
