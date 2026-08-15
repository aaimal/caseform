import { createServiceClient } from "@/lib/supabase/admin";

function pgMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Unknown database error";
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    cause?: { message?: string; code?: string };
  };
  const parts = [
    e.message,
    e.cause?.message,
    e.details,
    e.hint,
    e.code ? `code=${e.code}` : null,
  ].filter(Boolean);
  return parts.join(" | ") || "Unknown database error";
}

export async function ensureUserAndOrg(params: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  const admin = createServiceClient();

  const { error: userError } = await admin.from("users").upsert(
    {
      id: params.userId,
      email: params.email,
      display_name: params.displayName ?? null,
    },
    { onConflict: "id" },
  );

  if (userError) {
    throw new Error(`users upsert failed: ${pgMessage(userError)}`);
  }

  const { data: existing, error: memberLookupError } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", params.userId)
    .limit(1)
    .maybeSingle();

  if (memberLookupError) {
    throw new Error(`org_members lookup failed: ${pgMessage(memberLookupError)}`);
  }

  if (existing?.org_id) {
    return existing.org_id as string;
  }

  const workspaceName = `${params.displayName || params.email}'s workspace`;
  const { data: org, error: orgError } = await admin
    .from("orgs")
    .insert({ name: workspaceName })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(`orgs insert failed: ${pgMessage(orgError)}`);
  }

  const { error: memberError } = await admin.from("org_members").insert({
    org_id: org.id,
    user_id: params.userId,
    role: "owner",
  });

  if (memberError) {
    throw new Error(`org_members insert failed: ${pgMessage(memberError)}`);
  }

  return org.id as string;
}

export async function getUserOrgId(userId: string) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`org_members lookup failed: ${pgMessage(error)}`);
  }

  return (data?.org_id as string | undefined) ?? null;
}
