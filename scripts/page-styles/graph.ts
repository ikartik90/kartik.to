import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import ts from "typescript";

const compilerOptions = (cwd: string) => {
  const file = ts.findConfigFile(cwd, ts.sys.fileExists);
  if (!file) return {};
  return ts.parseJsonConfigFileContent(ts.readConfigFile(file, ts.sys.readFile).config, ts.sys, cwd).options;
};

/**
 * The files under `within` that `entries` import statically, entries included. What is only imported with `import()`
 * or for its types is left out: it is not in the page's first load.
 */
export function staticImports(entries: string[], within: string, cwd = process.cwd()): string[] {
  const options = compilerOptions(cwd);
  const folder = resolve(within) + sep;
  const seen = new Set<string>();
  const queue = entries.map((entry) => resolve(entry));

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
    for (const statement of source.statements) {
      const imports = ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly;
      const exports = ts.isExportDeclaration(statement) && !statement.isTypeOnly;
      if (!(imports || exports) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const found = ts.resolveModuleName(statement.moduleSpecifier.text, file, options, ts.sys).resolvedModule;
      if (!found || found.isExternalLibraryImport || found.resolvedFileName.endsWith(".d.ts")) continue;
      if (found.resolvedFileName.startsWith(folder)) queue.push(found.resolvedFileName);
    }
  }
  return [...seen];
}
