import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import {
  formatBriefForPrompt,
  formatExemplarsForPrompt,
  sanitizeText,
  truncateSpec,
} from "@/lib/exemplars/helpers";
import { interpolate, loadPrompt } from "@/lib/prompts/loader";
import { singleCaseJsonSchema } from "@/lib/prompts/schemas";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BRIEF,
  generationBriefSchema,
  testCaseBodySchema,
  type Step,
} from "@/lib/types";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  testCaseId: z.string().uuid(),
  feedback: z.string().trim().min(1).max(2000).optional(),
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

    const { projectId, testCaseId, feedback } = bodySchema.parse(await req.json());
    const admin = createServiceClient();

    if (feedback) {
      const { error: commentError } = await admin.from("test_case_comments").insert({
        org_id: orgId,
        project_id: projectId,
        test_case_id: testCaseId,
        body: sanitizeText(feedback),
        author_id: user.id,
      });
      if (commentError) {
        return NextResponse.json(
          { error: commentError.message },
          { status: 500 },
        );
      }
    }

    const { data: project } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: testCase } = await admin
      .from("test_cases")
      .select("*")
      .eq("id", testCaseId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!testCase) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    const { data: comments } = await admin
      .from("test_case_comments")
      .select("*")
      .eq("test_case_id", testCaseId)
      .is("consumed_in_generation_id", null);

    if (!comments?.length) {
      return NextResponse.json(
        { error: "Add feedback comments before regenerating" },
        { status: 400 },
      );
    }

    const { data: specs } = await admin
      .from("specifications")
      .select("*")
      .eq("project_id", projectId)
      .limit(1);
    const spec = specs?.[0];

    const { data: linkedSets } = await admin
      .from("project_exemplar_sets")
      .select("exemplar_set_id")
      .eq("project_id", projectId);

    const { data: exemplarRows } = linkedSets?.[0]
      ? await admin
          .from("exemplars")
          .select("*")
          .eq("exemplar_set_id", linkedSets[0].exemplar_set_id)
      : { data: [] as Record<string, unknown>[] };

    const brief = generationBriefSchema.parse(
      project.generation_brief ?? DEFAULT_BRIEF,
    );
    const briefVars = formatBriefForPrompt(brief);
    const { text: specText } = truncateSpec(spec?.raw_text ?? "", 20000);
    const tpl = loadPrompt("regenerate-from-feedback", "1");
    const ai = getAiProvider();

    const result = await ai.generate({
      model: tpl.model,
      temperature: tpl.temperature,
      responseSchema: singleCaseJsonSchema as unknown as Record<string, unknown>,
      prompt: {
        system: interpolate(tpl.system, briefVars),
        user: interpolate(tpl.user, {
          specText,
          exemplarCases: formatExemplarsForPrompt(
            (exemplarRows ?? []).map((e) => ({
              title: e.title as string,
              preconditions: (e.preconditions as string) ?? "",
              steps: e.steps as Step[],
            })),
          ),
          currentTestCaseJson: JSON.stringify(
            {
              title: testCase.title,
              preconditions: testCase.preconditions,
              steps: testCase.steps,
            },
            null,
            2,
          ),
          comments: comments.map((c) => `- ${c.body}`).join("\n"),
          ...briefVars,
        }),
      },
    });

    const revised = testCaseBodySchema.parse(result.parsed);

    const { data: generation, error: genError } = await admin
      .from("generations")
      .insert({
        org_id: orgId,
        project_id: projectId,
        specification_id: testCase.specification_id,
        kind: "regenerate",
        prompt_template_id: tpl.id,
        prompt_version: tpl.version,
        model: result.model,
        input_snapshot: {
          brief,
          testCaseId,
          commentIds: comments.map((c) => c.id),
        },
      })
      .select("id")
      .single();

    if (genError || !generation) {
      return NextResponse.json(
        { error: genError?.message || "Failed to save generation" },
        { status: 500 },
      );
    }

    await admin.from("test_case_revisions").insert({
      org_id: orgId,
      test_case_id: testCaseId,
      before: {
        title: testCase.title,
        preconditions: testCase.preconditions,
        steps: testCase.steps,
        version: testCase.version,
      },
      after: revised,
      source: "ai",
      generation_id: generation.id,
      edited_by: user.id,
    });

    const { data: updated, error: updateError } = await admin
      .from("test_cases")
      .update({
        title: revised.title,
        preconditions: revised.preconditions,
        steps: revised.steps,
        status: "edited",
        version: (testCase.version as number) + 1,
        generation_id: generation.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", testCaseId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await admin
      .from("test_case_comments")
      .update({ consumed_in_generation_id: generation.id })
      .in(
        "id",
        comments.map((c) => c.id),
      );

    return NextResponse.json({ testCase: updated });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
