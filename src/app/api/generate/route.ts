import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
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
  testCases,
} from "@/lib/db/schema";
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
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BRIEF,
  generationBriefSchema,
  generatedSuiteSchema,
  requirementsSchema,
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
    const db = getDb();

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [spec] = await db
      .select()
      .from(specifications)
      .where(eq(specifications.projectId, projectId))
      .orderBy(desc(specifications.createdAt))
      .limit(1);

    if (!spec?.rawText?.trim()) {
      return NextResponse.json(
        { error: "Add a specification before generating" },
        { status: 400 },
      );
    }

    const linkedSets = await db
      .select({ setId: projectExemplarSets.exemplarSetId })
      .from(projectExemplarSets)
      .where(eq(projectExemplarSets.projectId, projectId));

    if (linkedSets.length === 0) {
      return NextResponse.json(
        { error: "Attach at least one exemplar set" },
        { status: 400 },
      );
    }

    const exemplarRows = await db
      .select()
      .from(exemplars)
      .where(eq(exemplars.exemplarSetId, linkedSets[0].setId))
      .orderBy(asc(exemplars.sortOrder));

    if (exemplarRows.length < 1) {
      return NextResponse.json(
        { error: "Exemplar set needs at least one manual test case" },
        { status: 400 },
      );
    }

    const brief = generationBriefSchema.parse(
      project.generationBrief ?? DEFAULT_BRIEF,
    );
    const { text: specText, truncated } = truncateSpec(spec.rawText);
    const exemplarBodies = exemplarRows.map((e) => ({
      title: e.title,
      preconditions: e.preconditions,
      steps: e.steps,
    }));
    const briefVars = formatBriefForPrompt(brief);
    const ai = getAiProvider();

    // Pass A — requirements
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

    // Pass B — cases
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

    // Validate shape
    generatedSuiteSchema.parse({
      testCases: withReq.map((c) => ({
        title: c.title,
        preconditions: c.preconditions,
        steps: c.steps,
      })),
    });

    const { kept, dropped } = filterDrift(withReq, exemplarBodies);

    const [generation] = await db
      .insert(generations)
      .values({
        orgId,
        projectId,
        specificationId: spec.id,
        kind: "generate",
        promptTemplateId: genTpl.id,
        promptVersion: genTpl.version,
        model: genResult.model,
        inputSnapshot: {
          brief,
          requirementCount: requirements.requirements.length,
          requirements: requirements.requirements,
          exemplarIds: exemplarRows.map((e) => e.id),
          specTruncated: truncated,
          droppedDriftTitles: dropped.map((d) => d.title),
        },
      })
      .returning();

    await db.delete(testCases).where(eq(testCases.projectId, projectId));

    const inserted = await db
      .insert(testCases)
      .values(
        kept.map((c) => ({
          orgId,
          projectId,
          specificationId: spec.id,
          title: c.title,
          preconditions: c.preconditions ?? "",
          steps: c.steps,
          status: "generated" as const,
          generationId: generation.id,
          version: 1,
          requirementId: c.requirementId ?? null,
        })),
      )
      .returning();

    await db
      .update(projects)
      .set({ status: "generated", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({
      generationId: generation.id,
      count: inserted.length,
      droppedDrift: dropped.length,
      requirements: requirements.requirements,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
