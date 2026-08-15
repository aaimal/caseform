import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgMembers, orgs, users } from "@/lib/db/schema";

export async function ensureUserAndOrg(params: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  const db = getDb();

  await db
    .insert(users)
    .values({
      id: params.userId,
      email: params.email,
      displayName: params.displayName ?? null,
    })
    .onConflictDoNothing();

  const existing = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, params.userId))
    .limit(1);

  if (existing[0]) {
    return existing[0].orgId;
  }

  const [org] = await db
    .insert(orgs)
    .values({ name: `${params.displayName || params.email}'s workspace` })
    .returning();

  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: params.userId,
    role: "owner",
  });

  return org.id;
}

export async function getUserOrgId(userId: string) {
  const db = getDb();
  const rows = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}
