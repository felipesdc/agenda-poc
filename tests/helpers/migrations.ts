// Trigger bodies contain semicolons; newer SQLs mark full statement boundaries.
export function migrationStatements(sql: string) {
  return sql.split(sql.includes("-- statement-breakpoint") ? "-- statement-breakpoint" : ";").map((part) => part.trim()).filter(Boolean);
}
