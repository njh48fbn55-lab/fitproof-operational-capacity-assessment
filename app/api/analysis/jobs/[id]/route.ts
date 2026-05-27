import { NextResponse } from "next/server";
import { getJob } from "@/lib/analysis/job-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await getJob(id);
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Analysis job not found." }, { status: 404 });
  }
}
