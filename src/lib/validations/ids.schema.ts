import { z } from 'zod';
import { isOrganizationId } from '@/types/ids';

/**
 * A WorkOS organization id from a path or body. It refines with the branded
 * id's own guard, so the shape is written once (types/ids.ts) and a request
 * schema cannot drift from what the repositories accept.
 */
export const organizationIdSchema = z.string().refine(isOrganizationId, 'Invalid organization id');
