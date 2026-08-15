import { NextResponse } from "next/server";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = await ensureUserAndOrg({
    userId: user.id,
    email: user.email,
    displayName: user.user_metadata?.full_name,
  });
  return NextResponse.json({ orgId });
}
