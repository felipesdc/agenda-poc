import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ManagedUser } from "./user-input";

export async function getUserAudit() {
  const actor = await getCurrentUser();
  if (actor?.role !== "ADMIN") return null;
  return prisma.userAudit.findMany({
    where: { unitId: actor.unitId }, orderBy: [{ timestamp: "desc" }, { id: "desc" }], take: 100,
  });
}

export async function getManagedUsers(): Promise<ManagedUser[] | null> {
  const actor = await getCurrentUser();
  if (actor?.role !== "ADMIN") return null;
  const users = await prisma.user.findMany({
    where: { unitId: actor.unitId }, orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true,
      identity: { select: { accounts: { where: { providerId: "credential", password: { not: null } }, select: { id: true }, take: 1 } } },
    },
  });
  return users.map(({ identity, ...user }) => ({ ...user, hasPassword: Boolean(identity?.accounts.length) }));
}
