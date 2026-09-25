/**
 * Classifies the state-changing handlers a Next route file exports, for the
 * route-guard ratchet (scripts/check-route-guards.mjs).
 *
 * The ratchet used to find handlers with a regular expression that saw only
 * `export async function VERB` and `export const VERB`, and then accepted a
 * guard's name anywhere in the text that followed. `export function POST`,
 * `export let POST` and `export { handler as POST }` were never looked at,
 * and `requireSameOrigin` in a string literal counted as readily as a call.
 * Reading the syntax tree turns the question round: every top-level export
 * that can yield a verb is found, a handler is guarded only in one of the
 * shapes recognised here, and an export this module cannot follow is
 * reported as such. A new export form therefore fails the check until
 * someone teaches the checker about it, instead of passing unseen.
 */

import ts from 'typescript';

/** The verbs that change state. GET, HEAD and OPTIONS are not checked. */
const STATE_CHANGING_VERBS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isCallTo(node, name) {
  return (
    node !== undefined &&
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  );
}

function isIdentifierNamed(node, name) {
  return node !== undefined && ts.isIdentifier(node) && node.text === name;
}

/**
 * `const x = requireSameOrigin(request); if (x) return x;` as the first two
 * statements of the body, the preamble the pre-session auth handlers share.
 * The call anywhere later is not enough: whatever runs before it runs for a
 * foreign origin too.
 */
function opensWithSameOriginGuard(body) {
  const [declaration, check] = body?.statements ?? [];

  if (
    declaration === undefined ||
    check === undefined ||
    !ts.isVariableStatement(declaration) ||
    !ts.isIfStatement(check) ||
    declaration.declarationList.declarations.length !== 1
  ) {
    return false;
  }

  const [{ name, initializer }] = declaration.declarationList.declarations;

  if (!ts.isIdentifier(name) || !isCallTo(initializer, 'requireSameOrigin')) {
    return false;
  }

  const { thenStatement } = check;
  const returned =
    ts.isBlock(thenStatement) && thenStatement.statements.length === 1
      ? thenStatement.statements[0]
      : thenStatement;

  return (
    isIdentifierNamed(check.expression, name.text) &&
    ts.isReturnStatement(returned) &&
    isIdentifierNamed(returned.expression, name.text)
  );
}

/** Every name a declaration binds, destructuring included. */
function boundNames(name) {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }

  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : boundNames(element.name)
  );
}

/**
 * `export const VERB = defineRoute(...)` or `definePublicRoute(...)`, called
 * directly. A `let` or `var` can be reassigned after the check has looked,
 * and a destructured binding hides where the handler came from.
 */
function classifyDeclaration(declaration, flags) {
  const isConst = (flags & ts.NodeFlags.BlockScoped) === ts.NodeFlags.Const;

  if (!isConst || !ts.isIdentifier(declaration.name)) {
    return 'unanalysable';
  }

  if (isCallTo(declaration.initializer, 'defineRoute')) {
    return 'define-route';
  }

  if (isCallTo(declaration.initializer, 'definePublicRoute')) {
    return 'public';
  }

  return 'unguarded';
}

/**
 * Lists the state-changing handlers a route file exports.
 *
 * `kind` is 'define-route' or 'same-origin' for a guarded handler, 'public'
 * for definePublicRoute (which the caller must find in its PUBLIC list),
 * 'unguarded', or 'unanalysable' for an export whose handler is defined
 * somewhere this file does not show. `export * from` is reported with the
 * verb '*', since it can yield any of them. `line` is 1-based.
 *
 * @param {string} source The file's text.
 * @param {string} fileName Its name; a `.tsx` name parses as TSX.
 * @returns {{ verb: string, kind: string, line: number }[]}
 */
export function classifyRouteSource(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const handlers = [];

  const report = (verb, kind, node) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

    handlers.push({ verb, kind, line: line + 1 });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      // `export { handler as POST }`, `export { POST } from './x'` and
      // `export * from './x'` all name a handler defined elsewhere.
      const clause = statement.exportClause;

      if (clause === undefined) {
        report('*', 'unanalysable', statement);
      } else if (ts.isNamespaceExport(clause)) {
        if (STATE_CHANGING_VERBS.has(clause.name.text)) {
          report(clause.name.text, 'unanalysable', statement);
        }
      } else {
        for (const element of clause.elements) {
          if (STATE_CHANGING_VERBS.has(element.name.text)) {
            report(element.name.text, 'unanalysable', element);
          }
        }
      }
      continue;
    }

    // `export default function POST` exports `default`, which Next ignores.
    if (
      !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      const { declarations, flags } = statement.declarationList;

      for (const declaration of declarations) {
        for (const verb of boundNames(declaration.name)) {
          if (STATE_CHANGING_VERBS.has(verb)) {
            report(verb, classifyDeclaration(declaration, flags), declaration);
          }
        }
      }
    } else if (ts.isFunctionDeclaration(statement)) {
      const verb = statement.name?.text;

      if (verb !== undefined && STATE_CHANGING_VERBS.has(verb)) {
        report(
          verb,
          opensWithSameOriginGuard(statement.body) ? 'same-origin' : 'unguarded',
          statement
        );
      }
    } else if (
      !ts.isInterfaceDeclaration(statement) &&
      !ts.isTypeAliasDeclaration(statement) &&
      statement.name !== undefined &&
      ts.isIdentifier(statement.name) &&
      STATE_CHANGING_VERBS.has(statement.name.text)
    ) {
      // A class, enum, namespace or `export import` named after a verb:
      // nothing a route should export, and nothing this check can vouch for.
      report(statement.name.text, 'unanalysable', statement);
    }
  }

  return handlers;
}
