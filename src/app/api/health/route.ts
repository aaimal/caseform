import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "caseform",
    build: "2026-08-16-bytestring-fix",
    hasSupabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  });
}
