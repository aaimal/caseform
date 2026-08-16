import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { sanitizeText } from "@/lib/exemplars/helpers";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generationBriefSchema } from "@/lib/types";

const bodySchema = z.object({
  specText: z.string(),
  brief: generationBriefSchema,
  exemplarSetId: z.string().uuid().nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await ctx.params;
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

    const body = bodySchema.parse(await req.json());
    const cleanSpec = sanitizeText(body.specText);
    const admin = createServiceClient();

    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error: projectError } = await admin
      .from("projects")
      .update({
        generation_brief: body.brief,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    const { data: existingSpecs } = await admin
      .from("specifications")
      .select("id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingSpecs?.[0]) {
      const { error } = await admin
        .from("specifications")
        .update({ raw_text: cleanSpec })
        .eq("id", existingSpecs[0].id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (cleanSpec.trim()) {
      const { error } = await admin.from("specifications").insert({
        org_id: orgId,
        project_id: projectId,
        source_type: "paste",
        raw_text: cleanSpec,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    await admin.from("project_exemplar_sets").delete().eq("project_id", projectId);
    if (body.exemplarSetId) {
      const { error } = await admin.from("project_exemplar_sets").insert({
        project_id: projectId,
        exemplar_set_id: body.exemplarSetId,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, specLength: cleanSpec.length });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to save project inputs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
