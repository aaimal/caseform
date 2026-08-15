import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BRIEF } from "@/lib/types";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title } = bodySchema.parse(await req.json());
    const orgId = await ensureUserAndOrg({
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name,
    });

    const admin = createServiceClient();
    const { data: project, error } = await admin
      .from("projects")
      .insert({
        org_id: orgId,
        title,
        status: "draft",
        generation_brief: DEFAULT_BRIEF,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: error?.message || "Could not create project" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: project.id });
  } catch (err) {
    console.error("create project failed", err);
    const message =
      err instanceof Error ? err.message : "Could not create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
