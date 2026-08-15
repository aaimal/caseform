import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { getDb } from "@/lib/db";
import { projects, testCases } from "@/lib/db/schema";
import { casesToCsv } from "@/lib/export/csv";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await ctx.params;
    const url = new URL(req.url);
    const jira = url.searchParams.get("format") === "jira";
    const includeEdited = url.searchParams.get("includeEdited") === "1";

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

    const db = getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const statuses = includeEdited
      ? (["accepted", "edited"] as const)
      : (["accepted"] as const);

    const rows = await db
      .select()
      .from(testCases)
      .where(
        and(
          eq(testCases.projectId, projectId),
          inArray(testCases.status, [...statuses]),
        ),
      );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: includeEdited
            ? "No accepted or edited cases to export"
            : "Accept at least one test case before exporting",
        },
        { status: 400 },
      );
    }

    const csv = casesToCsv(
      rows.map((r) => ({
        title: r.title,
        preconditions: r.preconditions,
        steps: r.steps,
        status: r.status,
      })),
      { jira },
    );

    const filename = `${project.title.replace(/\s+/g, "-").toLowerCase()}-${jira ? "jira" : "cases"}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
