import { z } from 'zod';

/**
 * The app's database settings, validated on first use rather than at import,
 * so `next build` and every test that never queries need no DATABASE_URL.
 *
 * The refinements are tripwires for the mistakes that would silently undo the
 * access model: the owner's URL pasted into the app's slot (the owner bypasses
 * RLS), the direct host instead of the pooler (Cloud Run instances would each
 * hold real backends), or TLS without certificate verification.
 *
 * They must read the URL the way pg does, and pg reads more of it than
 * `new URL()` shows. pg-connection-string copies every query parameter into
 * the client config, over the URL's own parts and over the Pool options:
 * `?user=` replaces the username, `?host=` the host, and `?options=` sets
 * session settings at login (`-c statement_timeout=0` undoes the role's
 * timeout). It also keeps the LAST of a repeated key, where
 * `searchParams.get` returns the first, so
 * `?sslmode=verify-full&sslmode=no-verify` read as verified here and
 * connected without checking the certificate. A `socket:` URL connects to
 * the Unix socket named by its path, whatever host it shows. Until
 * 24 Sep 2026 each of those passed every check below. Now the scheme is
 * pinned, a parameter may appear once, and only the TLS parameters are
 * allowed: `channel_binding` for Neon's copied form (pg ignores it) and
 * `sslrootcert`, which swaps the CAs verify-full trusts for one file but
 * still checks the certificate and host name (the local Postgres the cloud
 * sessions use needs it). An allowlist rather than a list of known
 * overrides, because pg's options grow and each new one would be a way round
 * a check.
 */

const ALLOWED_SCHEMES = ['postgres:', 'postgresql:'];
const ALLOWED_PARAMETERS = ['sslmode', 'channel_binding', 'sslrootcert'];

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is not set' })
    .refine((value) => parseUrl(value) !== null, 'DATABASE_URL is not a URL')
    .refine(
      (value) => ALLOWED_SCHEMES.includes(parseUrl(value)?.protocol ?? ''),
      'DATABASE_URL must use the postgres:// or postgresql:// scheme'
    )
    .refine(
      (value) => parseUrl(value)?.hostname.includes('-pooler.') ?? false,
      'DATABASE_URL must use the Neon pooled host (-pooler.)'
    )
    .refine(
      (value) => parseUrl(value)?.username === 'sculptors_app',
      'DATABASE_URL must connect as sculptors_app, not the owner'
    )
    .refine(
      // pg-connection-string treats sslmode=require as verify-full today but
      // warns, and pg 9 will switch it to libpq's "encrypt, do not verify".
      (value) => parseUrl(value)?.searchParams.get('sslmode') === 'verify-full',
      'DATABASE_URL must carry sslmode=verify-full'
    )
    .refine((value) => {
      const params = parseUrl(value)?.searchParams;

      return Array.from(params?.keys() ?? []).every((key) => params?.getAll(key).length === 1);
    }, 'DATABASE_URL must not repeat a query parameter')
    .refine(
      (value) =>
        Array.from(parseUrl(value)?.searchParams.keys() ?? []).every((key) =>
          ALLOWED_PARAMETERS.includes(key)
        ),
      'DATABASE_URL may carry only sslmode, channel_binding and sslrootcert'
    ),
});

export type DatabaseEnv = z.infer<typeof schema>;

/**
 * Owner-only settings. They belong in .env.migrate.local, which only
 * `npm run db:migrate` loads; in the app's environment they would put a
 * BYPASSRLS credential in the server process with nothing reading it, which
 * no other check notices. An empty value (a copied template) is harmless.
 */
const OWNER_ONLY_KEYS = ['DATABASE_URL_UNPOOLED', 'NEON_API_KEY'] as const;

let parsed: DatabaseEnv | undefined;

export function dbEnv(): DatabaseEnv {
  if (!parsed) {
    const leaked = OWNER_ONLY_KEYS.filter((key) => Boolean(process.env[key]));

    if (leaked.length > 0) {
      throw new Error(
        `Invalid database configuration: ${leaked.join(', ')} must not be in the app's environment; ` +
          'move it to .env.migrate.local (see .env.migrate.example).'
      );
    }

    const result = schema.safeParse({ DATABASE_URL: process.env.DATABASE_URL });

    if (!result.success) {
      // The issue messages name the rule, never the value: the URL holds a password.
      throw new Error(`Invalid database configuration: ${result.error.issues.map((i) => i.message).join('; ')}`);
    }

    parsed = result.data;
  }

  return parsed;
}
