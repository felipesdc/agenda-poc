import { PrismaClient } from "@prisma/client";
import { link, mkdir, mkdtemp, open, rm, stat, chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export function sqliteDatabasePath(databaseUrl: string, schemaDirectory = resolve("prisma")) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.startsWith("file::memory:")) throw new Error("Configure um DATABASE_URL SQLite em arquivo.");
  const path = databaseUrl.slice(5).split("?")[0];
  if (!path) throw new Error("O caminho do banco não foi informado.");
  return resolve(schemaDirectory, path);
}

export async function verifyDatabase(file: string) {
  const info = await stat(file);
  if (!info.isFile() || info.size === 0) throw new Error("O banco informado está vazio ou não é um arquivo.");
  const database = new PrismaClient({ datasources: { db: { url: `file:${resolve(file)}` } } });
  try {
    const integrity = await database.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") throw new Error("A verificação de integridade do banco falhou.");
    const foreignKeys = await database.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    if (foreignKeys.length) throw new Error("O banco contém vínculos inválidos.");
    const tables = await database.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const required of ["Task", "User", "Unit", "TaskHistory", "AuthAccount", "AuthSession", "UserAudit", "_prisma_migrations"]) {
      if (!tables.some((table) => table.name === required)) throw new Error("O arquivo não contém um banco da agenda com as migrações necessárias.");
    }
    const [{ pending }] = await database.$queryRawUnsafe<{ pending: bigint }[]>("SELECT COUNT(*) AS pending FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL");
    if (Number(pending)) throw new Error("O banco contém migração incompleta. Revise antes de restaurar.");
  } finally { await database.$disconnect(); }
}

// VACUUM INTO takes a consistent SQLite snapshot, including committed WAL data.
// Publish with a hard link only after validation; link fails rather than overwriting any destination.
export async function createDatabaseSnapshot(source: string, destination: string, options: { revokeSessions?: boolean } = {}) {
  const sourcePath = resolve(source);
  const outputPath = resolve(destination);
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile() || !sourceInfo.size) throw new Error("Banco de origem inexistente, vazio ou inválido.");
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(join(dirname(outputPath), ".agenda-snapshot-"));
  const snapshot = join(temporary, "snapshot.db");
  const database = new PrismaClient({ datasources: { db: { url: `file:${sourcePath}` } } });
  try {
    const escapedPath = snapshot.replace(/'/g, "''");
    await database.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);
    await chmod(snapshot, 0o600);
    if (options.revokeSessions) {
      const restored = new PrismaClient({ datasources: { db: { url: `file:${snapshot}` } } });
      try { await restored.authSession.deleteMany(); } finally { await restored.$disconnect(); }
    }
    await verifyDatabase(snapshot);
    const handle = await open(snapshot, "r");
    try { await handle.sync(); } finally { await handle.close(); }
    await link(snapshot, outputPath);
    return outputPath;
  } finally {
    await database.$disconnect();
    await rm(temporary, { recursive: true, force: true });
  }
}
