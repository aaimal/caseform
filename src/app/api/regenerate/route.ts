import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { getDb } from "@/lib/db";
import {
  exemplars,
  generations,
  projectExemplarSets,
  projects,
  specifications,
  testCaseComments,
  testCaseRevisions,
  testCases,
} from "@/lib/db/schema";
import {
  formatBriefForPrompt,
  formatExemplarsForPrompt,
  truncateSpec,
} from "@/lib/exemplars/helpers";
import { interpolate, loadPrompt } from "@/lib/prompts/loader";
import { singleCaseJsonSchema } from "@/lib/prompts/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BRIEF,
  generationBriefSchema,
  testCaseBodySchema,
} from "@/lib/types";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  testCaseId: z.string().uuid(),
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

    const { projectId, testCaseId } = bodySchema.parse(await req.json());
    const db = getDb();

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [testCase] = await db
      .select()
      .from(testCases)
      .where(and(eq(testCases.id, testCaseId), eq(testCases.projectId, projectId)))
      .limit(1);
    if (!testCase) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }

    const comments = await db
      .select()
      .from(testCaseComments)
      .where(
        and(
          eq(testCaseComments.testCaseId, testCaseId),
          isNull(testCaseComments.consumedInGenerationId),
        ),
      );

    if (comments.length === 0) {
      return NextResponse.json(
        { error: "Add feedback comments before regenerating" },
        { status: 400 },
      );
    }

    const [spec] = await db
      .select()
      .from(specifications)
      .where(eq(specifications.projectId, projectId))
      .limit(1);

    const linkedSets = await db
      .select()
      .from(projectExemplarSets)
      .where(eq(projectExemplarSets.projectId, projectId));

    const exemplarRows =
      linkedSets[0]
        ? await db
            .select()
            .from(exemplars)
            .where(eq(exemplars.exemplarSetId, linkedSets[0].exemplarSetId))
        : [];

    const brief = generationBriefSchema.parse(
      project.generationBrief ?? DEFAULT_BRIEF,
    );
    const briefVars = formatBriefForPrompt(brief);
    const { text: specText } = truncateSpec(spec?.rawText ?? "", 20000);
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
            exemplarRows.map((e) => ({
              title: e.title,
              preconditions: e.preconditions,
              steps: e.steps,
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

    const [generation] = await db
      .insert(generations)
      .values({
        orgId,
        projectId,
        specificationId: testCase.specificationId,
        kind: "regenerate",
        promptTemplateId: tpl.id,
        promptVersion: tpl.version,
        model: result.model,
        inputSnapshot: {
          brief,
          testCaseId,
          commentIds: comments.map((c) => c.id),
        },
      })
      .returning();

    const before = {
      title: testCase.title,
      preconditions: testCase.preconditions,
      steps: testCase.steps,
      version: testCase.version,
    };

    await db.insert(testCaseRevisions).values({
      orgId,
      testCaseId,
      before,
      after: revised,
      source: "ai",
      generationId: generation.id,
      editedBy: user.id,
    });

    const [updated] = await db
      .update(testCases)
      .set({
        title: revised.title,
        preconditions: revised.preconditions,
        steps: revised.steps,
        status: "edited",
        version: testCase.version + 1,
        generationId: generation.id,
        updatedAt: new Date(),
      })
      .where(eq(testCases.id, testCaseId))
      .returning();

    for (const c of comments) {
      await db
        .update(testCaseComments)
        .set({ consumedInGenerationId: generation.id })
        .where(eq(testCaseComments.id, c.id));
    }

    return NextResponse.json({ testCase: updated });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
