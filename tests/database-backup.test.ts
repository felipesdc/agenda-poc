import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseSnapshot, sqliteDatabasePath, verifyDatabase } from "../src/lib/database-backup";
import { migrationStatements } from "./helpers/migrations";
let directory: string;
let source: string;
let db: PrismaClient;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "agenda-backup-tests-")); source = join(directory,"source.db");
  db = new PrismaClient({ datasources: { db: { url: `file:${source}` } } });
  for (const folder of (await readdir(resolve("prisma/migrations"))).sort()) {
    if (folder === "migration_lock.toml") continue;
    for (const sql of migrationStatements(await readFile(resolve("prisma/migrations",folder,"migration.sql"),"utf8"))) await db.$executeRawUnsafe(sql);
  }
  await db.$executeRawUnsafe('CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY, finished_at DATETIME, rolled_back_at DATETIME)');
  await db.$executeRawUnsafe("INSERT INTO _prisma_migrations VALUES ('fixture', CURRENT_TIMESTAMP, NULL)");
  await db.unit.create({ data: { id: "unit", code: "B", name: "Unidade backup" } });
  await db.user.create({ data: { id: "actor", name: "Gestor", email: "backup@test.invalid", unitId: "unit", role: "ADMIN" } });
  await db.authUser.create({ data: { id: "actor", name: "Gestor", email: "backup@test.invalid" } });
  await db.authSession.create({ data: { id: "session", token: "fixture-session", userId: "actor", expiresAt: new Date(Date.now()+3600000) } });
  await db.task.create({ data: { id: "task", title: "Relatório importante", dueDate: new Date(2026,0,1,12), unitId: "unit", createdById: "actor", history: { create: { action: "CREATE", userId: "actor" } } } });
});
afterAll(async () => { await db?.$disconnect(); if (directory) await rm(directory,{recursive:true,force:true}); });
describe("backup e restauração", () => {
  it("resolve caminhos SQLite relativos ao schema e recusa outros bancos", () => {
    expect(sqliteDatabasePath("file:./dev.db", "/project/prisma")).toBe("/project/prisma/dev.db");
    expect(sqliteDatabasePath("file:/private/tmp/example.db")).toBe("/private/tmp/example.db");
    expect(() => sqliteDatabasePath("postgres://db")).toThrow();
    expect(() => sqliteDatabasePath("file::memory:")).toThrow();
  });
  it("cria snapshot consistente com dados WAL, histórico e triggers, sem alterar origem", async () => {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
    const destination = join(directory,"backup's.db");
    await createDatabaseSnapshot(source,destination);
    await verifyDatabase(destination);
    const snapshot = new PrismaClient({ datasources: { db: { url: `file:${destination}` } } });
    try {
      expect(await snapshot.task.count()).toBe(1); expect(await snapshot.taskHistory.count()).toBe(1);
      expect(await snapshot.authSession.count()).toBe(1);
      await snapshot.task.update({ where: { id: "task" }, data: { title: "Reunião restaurada" } });
      expect((await snapshot.task.findUniqueOrThrow({ where: { id: "task" } })).searchText).toContain("reuniao restaurada");
      expect((await db.task.findUniqueOrThrow({ where: { id: "task" } })).title).toBe("Relatório importante");
      expect((await stat(destination)).mode & 0o777).toBe(0o600);
    } finally { await snapshot.$disconnect(); }
  });
  it("restaura em arquivo novo e revoga apenas as sessões da cópia", async () => {
    const target = join(directory,"restored.db");
    await createDatabaseSnapshot(source,target,{revokeSessions:true});
    const restored = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
    try { expect(await restored.authSession.count()).toBe(0); expect(await restored.taskHistory.count()).toBe(1); }
    finally { await restored.$disconnect(); }
    expect(await db.authSession.count()).toBe(1);
  });
  it("não sobrescreve destino existente nem o banco de origem", async () => {
    const target = join(directory,"existing.txt"); await writeFile(target,"preservar");
    await expect(createDatabaseSnapshot(source,target)).rejects.toMatchObject({code:"EEXIST"});
    expect(await readFile(target,"utf8")).toBe("preservar");
    await expect(createDatabaseSnapshot(source,source)).rejects.toMatchObject({code:"EEXIST"});
    expect(await db.task.count()).toBe(1);
  });
  it("recusa origem ausente/corrompida e limpa temporários após falha", async () => {
    const corrupt = join(directory,"corrupt.db"); await writeFile(corrupt,"isto não é SQLite");
    await expect(createDatabaseSnapshot(corrupt,join(directory,"bad.db"))).rejects.toBeDefined();
    await expect(createDatabaseSnapshot(join(directory,"missing.db"),join(directory,"none.db"))).rejects.toBeDefined();
    expect((await readdir(directory)).some((name)=>name.startsWith(".agenda-snapshot-"))).toBe(false);
  });
  it("recusa migração incompleta", async () => {
    const target = join(directory,"pending.db"); await createDatabaseSnapshot(source,target);
    const pending = new PrismaClient({ datasources:{db:{url:`file:${target}`}} });
    try { await pending.$executeRawUnsafe("INSERT INTO _prisma_migrations VALUES ('unfinished', NULL, NULL)"); }
    finally { await pending.$disconnect(); }
    await expect(verifyDatabase(target)).rejects.toThrow("migração incompleta");
  });
});
