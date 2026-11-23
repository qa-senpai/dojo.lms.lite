import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import ts from 'typescript';

const moduleName = file => /^src\/modules\/([^/]+)\//.exec(file)?.[1];
// Shared test support (`src/testing`) is open to tests and module fixtures only.
const isTestCode = file => /\.test\.[cm]?[jt]sx?$/.test(file) || /\/testing\//.test(file);
// `rules.ts` is the browser-safe entry for pure rules shared by RSC, routes and
// client components; it is checked like a client graph without 'use client'.
const rulesEntry = file => /^src\/modules\/[^/]+\/rules\.ts$/.test(file);
const contractName = file => /^src\/contracts\/(content|analytics|legal|contact)\//.exec(file)?.[1];
const sharedContract = file => !!contractName(file);
// Separate pure contracts keep Markdown and analytics dependencies out of
// unrelated consumers. Only these explicit subpaths are public, not arbitrary internals.
const contractEntry = file => /^src\/contracts\/content\/(tabs|timecodes|markdown)\.ts$/.test(file)
  || /^src\/contracts\/analytics\/(events|attribution)\.ts$/.test(file)
  || file === 'src/contracts/legal/documents.ts'
  || file === 'src/contracts/contact/phone.ts';
const publicEntry = file => /^src\/modules\/[^/]+\/(server|client|types)\.tsx?$/.test(file)
  || rulesEntry(file) || file === 'src/modules/homework/worker.ts' || ['src/modules/course-files/node.ts', 'src/modules/content-cli/node.ts', 'src/modules/catalog-skills/node.ts', 'src/modules/snippets/node.ts', 'src/modules/course-authoring/node.ts', 'src/modules/blog/node.ts'].includes(file);
const contentFiles = file => file.startsWith('src/platform/content-files/');
const fileRules = file => file === 'src/platform/content-files/rules.ts';
const fileEntry = file => fileRules(file) || file === 'src/platform/content-files/node.ts';
const nodeBuiltins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));

export function readSources(directory = 'src') {
  const files = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (file !== 'src/generated') walk(file);
        else files['src/generated/prisma/client.ts'] = readFileSync('src/generated/prisma/client.ts', 'utf8');
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(file)) files[file] = readFileSync(file, 'utf8');
    }
  }
  walk(directory);
  return files;
}

/** Parse imports instead of regex matching: includes exports, import types and dynamic imports. */
export function checkModuleBoundaries(files) {
  const errors = new Set();
  const graph = new Map();
  const clients = new Set();
  const serverActions = new Set();
  const workers = new Set();
  const nextOnly = new Set();
  const nonPortableSchemaDependencies = new Map();
  const analyticsSdks = new Set();
  const servers = new Set(['src/platform/db/server.ts', 'src/platform/db/client.ts', 'src/platform/db/maintenance.ts', 'src/platform/db/prisma.ts', 'src/lib/auth.ts']);
  const edgeUnsafe = new Set();
  const report = message => errors.add(message);
  const resolve = (from, specifier) => {
    const base = specifier.startsWith('@/') ? `src/${specifier.slice(2)}`
      : specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)) : null;
    if (!base) return null;
    const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'].map(ext => base + ext)];
    return candidates.find(file => Object.hasOwn(files, file)) ?? base;
  };

  for (const [file, source] of Object.entries(files)) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const owner = moduleName(file);
    // Next compiles a file-level Server Function import to a client RPC stub.
    // Only the directive prologue counts; a string later in a module does not.
    for (const statement of ast.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
      if (statement.expression.text === 'use server') { serverActions.add(file); nextOnly.add(file); }
    }
    if (fileRules(file) || rulesEntry(file) || contractEntry(file) || file === 'src/platform/analytics/client.ts' || file === 'src/instrumentation-client.ts') clients.add(file);
    if (file === 'src/modules/homework/worker.ts' || ['src/modules/course-files/node.ts', 'src/modules/content-cli/node.ts', 'src/modules/catalog-skills/node.ts', 'src/modules/snippets/node.ts', 'src/modules/course-authoring/node.ts', 'src/modules/blog/node.ts'].includes(file)) { workers.add(file); servers.add(file); }
    const edges = [];
    graph.set(file, edges);
    if (ast.statements.some(node => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use client')) clients.add(file);
    if (owner && /\/server\.tsx?$/.test(file)) {
      servers.add(file);
      if (!ast.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'server-only')) report(`${file}: server entry must import 'server-only'`);
    }
    if (owner && /\/client\.tsx?$/.test(file) && !clients.has(file)) report(`${file}: client entry must declare 'use client'`);
    if (owner && file.endsWith('/types.ts')) {
      for (const node of ast.statements) {
        if (!(ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
          || (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)
          || (ts.isExportDeclaration(node) && node.isTypeOnly))) report(`${file}: types entry may contain only type declarations/imports/exports`);
      }
    }
    function add(specifier, typeOnly = false) {
      if (!specifier || !ts.isStringLiteralLike(specifier)) {
        if (owner || sharedContract(file)) report(`${file}: module imports must use a literal path`);
        return;
      }
      const name = specifier.text;
      if (!typeOnly && (nodeBuiltins.has(name) || /^(bcryptjs|bcrypt|next-auth|@auth\/|@prisma\/)/.test(name))) edgeUnsafe.add(file);
      if (name === 'server-only' || name === 'next' || name.startsWith('next/') || /^(next-auth|@auth\/)/.test(name) || nodeBuiltins.has(name)) {
        nonPortableSchemaDependencies.set(file, name);
      }
      if (name === 'server-only' || name === 'posthog-node') servers.add(file);
      if (!typeOnly && /^(posthog-js|posthog-node)(\/|$)/.test(name)) analyticsSdks.add(file);
      if (!typeOnly && (name === 'server-only' || name === 'next' || name.startsWith('next/') || /^(next-auth|@auth\/)/.test(name))) nextOnly.add(file);
      if (!typeOnly && (nodeBuiltins.has(name) || name.startsWith('@prisma/') || name.startsWith('@/generated/'))) servers.add(file);
      if (contentFiles(file) && !isTestCode(file) && !typeOnly && (name === 'server-only' || name === 'next' || name.startsWith('next/'))) report(`${file}: content files must remain independent of Next`);
      const target = resolve(file, name);
      if (!target) return;
      edges.push({ target, typeOnly, specifier: name });
      const other = moduleName(target);
      if (contentFiles(target) && !contentFiles(file) && !fileEntry(target)) report(`${file}: use a public content-files entry instead of ${target}`);
      if (contentFiles(file) && !isTestCode(file) && !contentFiles(target)
        && target !== 'src/platform/content-errors.ts' && !(typeOnly && target === 'src/platform/db/types.ts')) report(`${file}: content files require caller tx, not ${target}`);
      if (target.startsWith('src/generated/') && !file.startsWith('src/platform/db/') && !file.startsWith('src/generated/')) report(`${file}: use the platform DB contract instead of ${target}`);
      if (target === 'src/platform/db/content-guard.ts' && owner && !isTestCode(file)) report(`${file}: use the public platform DB contract instead of content-guard`);
      if (target === 'src/platform/db/client.ts' && !file.startsWith('src/platform/db/')) report(`${file}: raw DB singleton is private to platform/db`);
      if (target === 'src/platform/db/maintenance.ts' && !file.startsWith('src/platform/db/') && !file.startsWith('scripts/') && !file.startsWith('prisma/')) report(`${file}: maintenance DB is only for offline scripts`);
      if (target === 'src/platform/db/types.ts' && !typeOnly) report(`${file}: use import/export type for ${target}`);
      if (other && (file.startsWith('src/platform/') || file.startsWith('src/components/ui/') || sharedContract(file))) report(`${file}: shared infrastructure/UI cannot depend on ${target}`);
      if (file.startsWith('src/platform/') && /^src\/(app|actions|contracts)\//.test(target)) report(`${file}: shared infrastructure cannot depend on ${target}`);
      if (sharedContract(file) && !sharedContract(target) && !target.startsWith('src/platform/')
        && !(isTestCode(file) && target.startsWith('src/testing/'))) report(`${file}: shared contract cannot depend on ${target}`);
      if (sharedContract(target) && contractName(file) !== contractName(target) && !contractEntry(target)) report(`${file}: use a public shared contract instead of ${target}`);
      if (other && other !== owner && !publicEntry(target)) report(`${file}: use a public entry instead of ${target}`);
      if (other && target.endsWith('/types.ts') && !typeOnly) report(`${file}: use import/export type for ${target}`);
      if (owner && !other && !target.startsWith('src/platform/') && !target.startsWith('src/components/ui/')
        && !contractEntry(target) && !(isTestCode(file) && target.startsWith('src/testing/'))) {
        report(`${file}: undeclared dependency on ${target}`);
      }
      if ((owner || sharedContract(file)) && !Object.hasOwn(files, target) && !/\.(css|svg|png|jpg|woff2?)$/.test(target)) report(`${file}: unresolved local import ${name}`);
    }
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        add(node.moduleSpecifier, !!(clause?.isTypeOnly || (!clause?.name && named && ts.isNamedImports(named) && named.elements.length && named.elements.every(item => item.isTypeOnly))));
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const named = node.exportClause;
        add(node.moduleSpecifier, !!(node.isTypeOnly || (named && ts.isNamedExports(named) && named.elements.length && named.elements.every(item => item.isTypeOnly))));
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        add(node.argument.literal, true);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        add(node.moduleReference.expression, node.isTypeOnly);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        add(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }

  // Only cycles touching migrated modules are enforced; existing legacy cycles are out of scope.
  const visited = new Set();
  const stack = [];
  function cycles(file) {
    const index = stack.indexOf(file);
    if (index >= 0) {
      const cycle = [...stack.slice(index), file];
      if (cycle.some(file => moduleName(file) || sharedContract(file) || contentFiles(file))) report(`Module dependency cycle: ${cycle.join(' -> ')}`);
      return;
    }
    if (visited.has(file)) return;
    stack.push(file);
    for (const { target } of graph.get(file) ?? []) cycles(target);
    stack.pop();
    visited.add(file);
  }
  for (const file of graph.keys()) cycles(file);

  // Catalog schemas are also loaded by the standalone CLI from arbitrary cwd.
  // Check the complete local graph, including type imports, for alias leaks.
  const portableSeen = new Set();
  function inspectPortable(file) {
    if (portableSeen.has(file)) return;
    portableSeen.add(file);
    if (nonPortableSchemaDependencies.has(file)) report(`${file}: catalog schema graph must be browser-safe and independent of Next: ${nonPortableSchemaDependencies.get(file)}`);
    for (const { target, specifier } of graph.get(file) ?? []) {
      if (!specifier.startsWith('.')) report(`${file}: catalog schema graph requires relative local imports: ${specifier}`);
      inspectPortable(target);
    }
  }
  inspectPortable('src/modules/catalog-skills/rules.ts');
  inspectPortable('src/modules/content-cli/rules.ts');
  inspectPortable('src/modules/snippets/rules.ts');
  inspectPortable('src/modules/course-authoring/rules.ts');

  // Follow runtime imports transitively, including barrels and legacy helpers.
  for (const client of clients) {
    const seen = new Set();
    function inspect(file, chain) {
      if (seen.has(file)) return;
      seen.add(file);
      const next = [...chain, file];
      if (file !== client && serverActions.has(file) && !contractEntry(client) && !rulesEntry(client) && !fileRules(client)) return;
      if (contractEntry(client) && analyticsSdks.has(file)) report(`Shared contracts cannot depend on analytics SDKs: ${next.join(' -> ')}`);
      if (servers.has(file) && next.some(item => moduleName(item) || sharedContract(item) || item.startsWith('src/platform/'))) {
        report(`Server code in client graph: ${next.join(' -> ')}`);
        return;
      }
      for (const { target, typeOnly } of graph.get(file) ?? []) if (!typeOnly) inspect(target, next);
    }
    inspect(client, []);
  }
  for (const worker of workers) {
    const seen = new Set();
    function inspect(file, chain) {
      if (seen.has(file)) return;
      seen.add(file);
      const next = [...chain, file];
      if (nextOnly.has(file)) report(`Next-only code in worker graph: ${next.join(' -> ')}`);
      if (['src/modules/catalog-skills/node.ts', 'src/modules/snippets/node.ts', 'src/modules/course-authoring/node.ts', 'src/modules/blog/node.ts'].includes(worker)
        && (file.startsWith('src/modules/content-cli/') || /^src\/platform\/db\/(server|client|maintenance|content-guard)\.ts$/.test(file))) {
        report(`${moduleName(worker) === 'snippets' ? 'Snippet' : moduleName(worker) === 'course-authoring' ? 'Course tree' : 'Skill'} writer requires caller tx without workflow dependencies: ${next.join(' -> ')}`);
      }
      for (const { target, typeOnly } of graph.get(file) ?? []) if (!typeOnly) inspect(target, next);
    }
    inspect(worker, []);
  }
  // Auth config and optimistic proxy must stay safe through every local barrel.
  // Unlike a client RPC import, a Server Action is not an edge boundary.
  for (const root of ['src/lib/auth.config.ts', 'src/proxy.ts']) {
    const seen = new Set();
    function inspect(file, chain) {
      if (seen.has(file)) return;
      seen.add(file);
      const next = [...chain, file];
      if (servers.has(file) || serverActions.has(file) || edgeUnsafe.has(file)) report(`Server code in edge graph: ${next.join(' -> ')}`);
      for (const { target, typeOnly } of graph.get(file) ?? []) if (!typeOnly) inspect(target, next);
    }
    inspect(root, []);
  }
  return [...errors];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkModuleBoundaries({ ...readSources(), ...readSources('scripts'), ...readSources('prisma') });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Module boundaries OK');
}
