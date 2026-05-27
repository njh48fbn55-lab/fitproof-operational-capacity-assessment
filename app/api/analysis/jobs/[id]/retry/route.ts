import { NextResponse } from "next/server";
import { retryAnalysisJob } from "@/lib/analysis/worker";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await retryAnalysisJob(id);
    return NextResponse.json({ jobId: id, status: "queued" });
  } catch (error) {
    console.error("Analysis retry failed", error);
    return NextResponse.json({ error: "Unable to retry analysis job." }, { status: 500 });
  }
}
