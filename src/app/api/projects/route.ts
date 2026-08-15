import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
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

    const db = getDb();
    const [project] = await db
      .insert(projects)
      .values({
        orgId,
        title,
        status: "draft",
        generationBrief: DEFAULT_BRIEF,
        createdBy: user.id,
      })
      .returning({ id: projects.id });

    return NextResponse.json({ id: project.id });
  } catch (err) {
    console.error("create project failed", err);
    const message =
      err instanceof Error ? err.message : "Could not create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
