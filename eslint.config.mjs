import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Claude Code workflow scripts: orchestration, not app code, run by
      // the harness with its own globals (agent, phase, log).
      ".claude/**",
    ],
  },
  {
    rules: {
      // Code Quality Rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-unused-vars": "off", // TypeScript handles this
      // `varsIgnorePattern` is deliberately absent. It used to allow "^_",
      // which is what kept ~230 lines of dead code alive in the old product's
      // chat route (an unused LangChain tool and its vendor adapters, since
      // deleted) with a clean lint run. Unused *arguments* still need the escape hatch — a callback that
      // ignores its first parameter is normal — but an unused module-level
      // binding is dead code and should be deleted, not renamed.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      
      // TypeScript Specific
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      
      // React Best Practices
      "react/prop-types": "off", // TypeScript handles this
      "react/react-in-jsx-scope": "off", // Next.js handles this
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/self-closing-comp": "warn",
      "react/jsx-curly-brace-presence": ["warn", { props: "never", children: "never" }],
      
      // Import Organization
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      
      // General Best Practices
      "prefer-const": "warn",
      "no-var": "error",
      // No loose comparisons at all. The `== null` carve-out existed for
      // seven sites in the old product's orders, sessions and product-memory
      // code (16 Aug); they were deleted with it (22 Sep 2026), so the
      // exception went too. Spell out `=== null || === undefined` instead.
      "eqeqeq": ["error", "always"],
      "curly": ["warn", "multi-line"],
      "no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 0 }],
      "padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
      ],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    rules: {
      "no-console": "off",
      "padding-line-between-statements": "off",
    },
  },
];

/**
 * Architectural boundaries.
 *
 * Two rules doing two different jobs:
 *
 * LOCKED_ZONES are invariants measured at zero violations today. They are
 * errors from day one because nothing has to be migrated to satisfy them —
 * they only have to stay true. See docs/architecture/boundaries.md.
 *
 * The per-`files` blocks below are the ratchet. Flat config allows a different
 * severity per block, which is what lets a rule ship as a warning with a named
 * backlog and be promoted to `error` once that backlog is empty. Setting
 * everything to `error` at once would mean this config could not ship at all,
 * and a boundary config that cannot ship is a document, not a constraint.
 */
// The database is reached through services. Routes and UI never hold a
// handle, so a tenant query cannot be written where the tenant is not known
// (src/db/tenant.ts), and the driver and its credentials can never reach a
// browser bundle. Tests are the exception, as they are for the import rule
// below: a route test that drives the real handler on PGlite (the webhook's
// seam test) has to seed the database next to the route it tests.
const UI_NEVER_HOLDS_THE_DATABASE = {
  target: ["./src/app", "./src/components", "./src/hooks", "./src/contexts", "./src/providers"],
  from: ["./src/db", "./src/lib/identity"],
  message: "Routes, UI and use cases never touch the database directly — call a service in lib/.",
};

const LOCKED_ZONES = {
  basePath: import.meta.dirname,
  zones: [
    // app/ is a leaf: it composes everything and nothing composes it.
    { target: "./src/lib", from: "./src/app", message: "app/ is a leaf — infrastructure must not import routing." },
    { target: "./src/components", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/hooks", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/types", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/config", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/contexts", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/providers", from: "./src/app", message: "app/ is a leaf." },
    { target: "./src/db", from: "./src/app", message: "app/ is a leaf." },

    // types/ and config/ are pure leaves — they may not reach back up.
    {
      target: "./src/types",
      from: ["./src/lib", "./src/components", "./src/hooks"],
      message: "types/ must stay dependency-free.",
    },
    {
      target: "./src/config",
      from: ["./src/lib", "./src/components", "./src/hooks"],
      message: "config/ must stay dependency-free.",
    },

    // Shared infrastructure must not depend on the application it serves.
    {
      target: "./src/lib",
      from: ["./src/components", "./src/hooks", "./src/contexts"],
      message: "lib/ is shared infrastructure — invert the dependency or move this into the consumer.",
    },

    // Route handlers are transport, not view.
    {
      target: "./src/app/api",
      from: "./src/components",
      message: "Route handlers must not import view components.",
    },

    UI_NEVER_HOLDS_THE_DATABASE,

    // The WorkOS client and the session layer hold the server's API key. UI
    // reaches them through a route. A zone of its own, because
    // UI_NEVER_HOLDS_THE_DATABASE targets all of app/, and the routes in
    // app/api are exactly where lib/workos is meant to be imported.
    {
      target: [
        "./src/components",
        "./src/hooks",
        "./src/contexts",
        "./src/providers",
        "./src/features/*/ui/**",
      ],
      from: "./src/lib/workos",
      message: "lib/workos holds the server key and the session layer; UI reaches it through a route.",
    },

    // Inside a slice, dependencies point inward. These used to be
    // @typescript-eslint/no-restricted-imports patterns on `@/features/...`
    // specifiers only, while the slices import their own layers relatively
    // (`../application/ports`), so `../ui/x` from domain/ walked past them.
    // Zones compare the resolved file, so either spelling counts. A zone's
    // `from` must be all globs or none, hence the `/**` on every entry.
    // infrastructure/ importing ../application/ports is the adapter
    // implementing its port, and stays allowed.
    {
      target: "./src/features/*/domain/**",
      from: [
        "./src/features/*/application/**",
        "./src/features/*/infrastructure/**",
        "./src/features/*/api/**",
        "./src/features/*/ui/**",
      ],
      message: "domain/ is pure — no I/O, no framework, no persistence.",
    },
    {
      target: ["./src/features/*/application/**", "./src/features/*/infrastructure/**"],
      from: ["./src/features/*/api/**", "./src/features/*/ui/**"],
      message: "application/ and infrastructure/ know nothing of HTTP or React.",
    },
  ],
};

const CROSS_SLICE = {
  group: ["@/features/*/*/**"],
  message:
    "Cross-slice imports go through the barrel: @/features/<slice> or @/features/<slice>/server.",
};

/**
 * Who may import the database driver, the query builder and src/db. Only the
 * data layer itself (src/db), the identity repositories (src/lib/identity)
 * and tests. When the first tenant slice lands, its infrastructure/ folder is
 * opened here deliberately, not by default.
 *
 * Test fixtures (`*.test-utils.ts`) seed the database directly, so they are
 * behind the same fence: only tests and the data layer may load them.
 */
const DB_ONLY_IN_DATA_LAYER = {
  group: [
    "drizzle-orm",
    "drizzle-orm/*",
    "pg",
    "pg-*",
    "@/db",
    "@/db/*",
    "@/lib/identity/repositories/*",
    "@/lib/identity/internal/*",
    "@/lib/identity/testing*",
    "**/*.test-utils",
  ],
  message:
    "Database access lives in src/db and src/lib/identity. Call a service (lib/workos, lib/auth) instead.",
};

/**
 * The same boundary for what the two rules above cannot see. The pattern rule
 * matches import specifiers as written, so `../../db/client` from lib/ or
 * `./db/client` from src/ walked past it, and neither rule looks at a dynamic
 * `import()`. no-restricted-paths resolves the file instead, and
 * no-restricted-syntax covers the dynamic form.
 */
// lib/tenancy/resource-check.ts is the one lib/ module besides identity that
// sees src/db: it runs a route's resource check inside withTenant.
const DATA_LAYER_FILES = [
  "src/db/**",
  "src/lib/identity/**",
  "src/lib/tenancy/resource-check.ts",
  "src/**/*.test.ts",
  "src/instrumentation.ts",
];

const DB_PATH_ZONE = {
  target: "./src",
  from: ["./src/db", "./src/lib/identity/repositories", "./src/lib/identity/internal"],
  message:
    "Database access lives in src/db and src/lib/identity. Call a service (lib/workos, lib/auth) instead.",
};

// esquery ends a regex at the first slash, escaped or in a class, so the
// slashes are written as \x2F.
const DB_DYNAMIC_SPECIFIER = String.raw`/^(pg|pg-[\w.-]+|drizzle-orm|@\x2Fdb|@\x2Flib\x2Fidentity\x2F(repositories|internal))(\x2F.*)?$/`;

// Both selectors above, and no-restricted-paths, read the specifier from a
// string Literal. A template literal (import(`pg`)) or a variable has no
// such value, so it walked past all three; outside the data layer a module is
// named with a plain string or not loaded dynamically at all.
const COMPUTED_SPECIFIER_MESSAGE =
  "Name the module with a plain string literal, so the database fence can read it.";

const DB_DYNAMIC_IMPORTS = [
  {
    selector: `ImportExpression[source.value=${DB_DYNAMIC_SPECIFIER}]`,
    message: DB_ONLY_IN_DATA_LAYER.message,
  },
  {
    selector: `CallExpression[callee.name='require'][arguments.0.value=${DB_DYNAMIC_SPECIFIER}]`,
    message: DB_ONLY_IN_DATA_LAYER.message,
  },
  {
    selector: "ImportExpression[source.type!='Literal']",
    message: COMPUTED_SPECIFIER_MESSAGE,
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal']",
    message: COMPUTED_SPECIFIER_MESSAGE,
  },
];

const boundaryConfig = [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "import/no-restricted-paths": ["error", LOCKED_ZONES] },
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        { ...LOCKED_ZONES, zones: LOCKED_ZONES.zones.filter((zone) => zone !== UI_NEVER_HOLDS_THE_DATABASE) },
      ],
    },
  },

  // Cross-slice imports go through the barrel. Declared first and re-declared
  // in the blocks below, because flat config REPLACES a rule's options rather
  // than merging them — the last matching block wins outright, so every
  // narrower block has to restate the patterns it still wants.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["warn", { patterns: [CROSS_SLICE] }],
    },
  },

  // Database access, as an error: zero violations the day it shipped, so it
  // is an invariant, not a ratchet. Restates CROSS_SLICE because flat config
  // replaces the rule's options for every file this block matches.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: DATA_LAYER_FILES,
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [CROSS_SLICE, DB_ONLY_IN_DATA_LAYER] },
      ],
    },
  },

  // Resolved paths and dynamic imports, outside the data layer. Restates
  // LOCKED_ZONES because this block replaces the rule's options too.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: DATA_LAYER_FILES,
    rules: {
      "import/no-restricted-paths": [
        "error",
        { ...LOCKED_ZONES, zones: [...LOCKED_ZONES.zones, DB_PATH_ZONE] },
      ],
      "no-restricted-syntax": ["error", ...DB_DYNAMIC_IMPORTS],
    },
  },

  // Intra-feature layering. They shipped before src/features/ existed, so the
  // first slice (metrics, 23 Sep 2026) was held to them from its first line.
  // These patterns read the specifier as written, so they are what keeps
  // next/* and react out; a sibling layer is fenced on its resolved path by
  // the slice zones in LOCKED_ZONES, which catch a relative import too.
  {
    files: ["src/features/*/domain/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            CROSS_SLICE,
            DB_ONLY_IN_DATA_LAYER,
            {
              group: [
                "@/features/*/application/**",
                "@/features/*/infrastructure/**",
                "@/features/*/api/**",
                "@/features/*/ui/**",
                "next/**",
                "react",
              ],
              message: "domain/ is pure — no I/O, no framework, no persistence.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/*/application/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            CROSS_SLICE,
            DB_ONLY_IN_DATA_LAYER,
            {
              group: ["@/features/*/api/**", "@/features/*/ui/**", "next/server", "react"],
              message: "application/ is transport-agnostic — take a port as an argument.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/*/infrastructure/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            CROSS_SLICE,
            DB_ONLY_IN_DATA_LAYER,
            {
              group: ["@/features/*/api/**", "@/features/*/ui/**", "next/server"],
              message: "infrastructure/ must not know about HTTP or React.",
            },
          ],
        },
      ],
    },
  },
];

const config = [...eslintConfig, ...boundaryConfig];

export default config;
