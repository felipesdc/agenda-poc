import "dotenv/config";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createDatabaseSnapshot, sqliteDatabasePath, verifyDatabase } from "../src/lib/database-backup";

async function main() {
  const { values } = parseArgs({ options: { mode: { type: "string" }, source: { type: "string" }, output: { type: "string" } } });
  if (values.mode === "backup") {
    const source = sqliteDatabasePath(process.env.DATABASE_URL || "");
    const destination = values.output || `backups/agenda-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    const result = await createDatabaseSnapshot(source, destination);
    console.log(`Backup criado e verificado: ${result}`);
  } else if (values.mode === "restore") {
    if (!values.source || !values.output) throw new Error("Use npm run db:restore -- --source backup.db --output novo-banco.db");
    await verifyDatabase(resolve(values.source));
    const result = await createDatabaseSnapshot(values.source, values.output, { revokeSessions: true });
    console.log(`Banco restaurado e verificado em arquivo novo: ${result}`);
    console.log("Sessões restauradas foram revogadas. O DATABASE_URL não foi alterado; confira o novo banco antes de configurar a aplicação para utilizá-lo.");
  } else throw new Error("Modo inválido. Use db:backup ou db:restore.");
}
main().catch((error: unknown) => {
  const code = (error as NodeJS.ErrnoException)?.code;
  console.error(code === "EEXIST" ? "O destino já existe. Escolha outro caminho; nenhum arquivo foi sobrescrito."
    : code === "ENOENT" ? "Arquivo de origem ou diretório não encontrado. Confira os caminhos."
    : error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Falha no snapshot. Verifique o arquivo, permissões e espaço em disco.");
  process.exitCode = 1;
});
