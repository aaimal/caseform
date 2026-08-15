import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import {
  filterDrift,
  formatBriefForPrompt,
  formatExemplarsForPrompt,
  truncateSpec,
} from "@/lib/exemplars/helpers";
import { interpolate, loadPrompt } from "@/lib/prompts/loader";
import {
  requirementsJsonSchema,
  suiteJsonSchema,
} from "@/lib/prompts/schemas";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BRIEF,
  generationBriefSchema,
  generatedSuiteSchema,
  requirementsSchema,
  type Step,
} from "@/lib/types";

const bodySchema = z.object({
  projectId: z.string().uuid(),
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

    const orgId = await ensureUserAndOrg({
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name,
    });

    const { projectId } = bodySchema.parse(await req.json());
    const admin = createServiceClient();

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: specs, error: specError } = await admin
      .from("specifications")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (specError) {
      return NextResponse.json({ error: specError.message }, { status: 500 });
    }

    const spec = specs?.[0];
    if (!spec?.raw_text?.trim()) {
      return NextResponse.json(
        { error: "Add a specification before generating" },
        { status: 400 },
      );
    }

    const { data: linkedSets, error: linkError } = await admin
      .from("project_exemplar_sets")
      .select("exemplar_set_id")
      .eq("project_id", projectId);

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    if (!linkedSets?.length) {
      return NextResponse.json(
        { error: "Attach at least one exemplar set" },
        { status: 400 },
      );
    }

    const { data: exemplarRows, error: exemplarError } = await admin
      .from("exemplars")
      .select("*")
      .eq("exemplar_set_id", linkedSets[0].exemplar_set_id)
      .order("sort_order", { ascending: true });

    if (exemplarError) {
      return NextResponse.json({ error: exemplarError.message }, { status: 500 });
    }
    if (!exemplarRows?.length) {
      return NextResponse.json(
        { error: "Exemplar set needs at least one manual test case" },
        { status: 400 },
      );
    }

    const brief = generationBriefSchema.parse(
      project.generation_brief ?? DEFAULT_BRIEF,
    );
    const { text: specText, truncated } = truncateSpec(spec.raw_text);
    const exemplarBodies = exemplarRows.map((e) => ({
      title: e.title as string,
      preconditions: (e.preconditions as string) ?? "",
      steps: e.steps as Step[],
    }));
    const briefVars = formatBriefForPrompt(brief);
    const ai = getAiProvider();

    const extractTpl = loadPrompt("extract-requirements", "1");
    const extractResult = await ai.generate({
      model: extractTpl.model,
      temperature: extractTpl.temperature,
      responseSchema: requirementsJsonSchema as unknown as Record<string, unknown>,
      prompt: {
        system: extractTpl.system,
        user: interpolate(extractTpl.user, { specText }),
      },
    });
    const requirements = requirementsSchema.parse(extractResult.parsed);

    const genTpl = loadPrompt("generate-from-requirements", "1");
    const genResult = await ai.generate({
      model: genTpl.model,
      temperature: genTpl.temperature,
      responseSchema: suiteJsonSchema as unknown as Record<string, unknown>,
      prompt: {
        system: interpolate(genTpl.system, briefVars),
        user: interpolate(genTpl.user, {
          specText,
          requirementsJson: JSON.stringify(requirements.requirements, null, 2),
          exemplarCases: formatExemplarsForPrompt(exemplarBodies),
          ...briefVars,
        }),
      },
    });

    const withReq = (
      genResult.parsed as {
        testCases: Array<{
          title: string;
          preconditions: string;
          steps: { action: string; expected: string }[];
          requirementId?: string;
        }>;
      }
    ).testCases;

    generatedSuiteSchema.parse({
      testCases: withReq.map((c) => ({
        title: c.title,
        preconditions: c.preconditions,
        steps: c.steps,
      })),
    });

    const { kept, dropped } = filterDrift(withReq, exemplarBodies);

    const { data: generation, error: genInsertError } = await admin
      .from("generations")
      .insert({
        org_id: orgId,
        project_id: projectId,
        specification_id: spec.id,
        kind: "generate",
        prompt_template_id: genTpl.id,
        prompt_version: genTpl.version,
        model: genResult.model,
        input_snapshot: {
          brief,
          requirementCount: requirements.requirements.length,
          requirements: requirements.requirements,
          exemplarIds: exemplarRows.map((e) => e.id),
          specTruncated: truncated,
          droppedDriftTitles: dropped.map((d) => d.title),
        },
      })
      .select("id")
      .single();

    if (genInsertError || !generation) {
      return NextResponse.json(
        { error: genInsertError?.message || "Failed to save generation" },
        { status: 500 },
      );
    }

    await admin.from("test_cases").delete().eq("project_id", projectId);

    const { data: inserted, error: caseInsertError } = await admin
      .from("test_cases")
      .insert(
        kept.map((c) => ({
          org_id: orgId,
          project_id: projectId,
          specification_id: spec.id,
          title: c.title,
          preconditions: c.preconditions ?? "",
          steps: c.steps,
          status: "generated",
          generation_id: generation.id,
          version: 1,
          requirement_id: c.requirementId ?? null,
        })),
      )
      .select("id");

    if (caseInsertError) {
      return NextResponse.json(
        { error: caseInsertError.message },
        { status: 500 },
      );
    }

    await admin
      .from("projects")
      .update({ status: "generated", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return NextResponse.json({
      generationId: generation.id,
      count: inserted?.length ?? 0,
      droppedDrift: dropped.length,
      requirements: requirements.requirements,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
