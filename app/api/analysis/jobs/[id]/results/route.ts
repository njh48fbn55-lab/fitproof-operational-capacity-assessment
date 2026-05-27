import { NextResponse } from "next/server";
import { getJobResults } from "@/lib/analysis/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const results = await getJobResults(id);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Analysis results not found." }, { status: 404 });
  }
}
