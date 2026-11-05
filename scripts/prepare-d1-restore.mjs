// Preserve SQL values verbatim while moving schema before D1's interleaved data.
export function prepareD1Restore(bytes) {
  const sql = bytes.toString("utf8"), statements = [];
  let start = 0, quote = "", lineComment = false, blockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], next = sql[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (ch === quote) { if (next === quote) i++; else quote = ""; }
      continue;
    }
    if (ch === "-" && next === "-") { lineComment = true; i++; }
    else if (ch === "/" && next === "*") { blockComment = true; i++; }
    else if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "[") quote = "]";
    else if (ch === ";") { statements.push(sql.slice(start, i + 1)); start = i + 1; }
  }
  if (quote || blockComment) throw new Error("BACKUP_SQL_INCOMPLETE");
  if (sql.slice(start).trim()) statements.push(sql.slice(start));
  const tables = [], indexes = [], rows = [];
  for (const statement of statements) {
    const body = statement.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, "");
    if (!body) continue;
    if (/^PRAGMA\s+defer_foreign_keys\s*=/i.test(body)) continue;
    if (/^CREATE\s+TABLE\b/i.test(body)) tables.push(statement);
    else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(body)) indexes.push(statement);
    else if (/^INSERT\s+INTO\b/i.test(body)) rows.push(statement);
    else throw new Error("BACKUP_SQL_UNSUPPORTED");
  }
  return Buffer.from("PRAGMA defer_foreign_keys=TRUE;\n" + [...tables, ...indexes, ...rows].map(statement => statement.trim().replace(/;?$/, ";")).join("\n") + "\n");
}
