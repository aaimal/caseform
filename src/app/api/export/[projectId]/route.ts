import { NextResponse } from "next/server";
import { ensureUserAndOrg } from "@/lib/auth/workspace";
import { casesToCsv } from "@/lib/export/csv";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Step } from "@/lib/types";

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

    const admin = createServiceClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, title")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const statuses = includeEdited ? ["accepted", "edited"] : ["accepted"];
    const { data: rows, error } = await admin
      .from("test_cases")
      .select("title, preconditions, steps, status")
      .eq("project_id", projectId)
      .in("status", statuses);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows?.length) {
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
        steps: r.steps as Step[],
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
