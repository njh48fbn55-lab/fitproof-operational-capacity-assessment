import { NextResponse } from "next/server";
import { createAnalysisJob, createAssessmentRecord } from "@/lib/analysis/job-store";
import { enqueueAnalysisJob } from "@/lib/analysis/worker";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.profile?.organization || !body.profile?.websiteUrl || !body.result || !body.responses) {
      return NextResponse.json({ error: "Organization, website, responses, and assessment result are required." }, { status: 400 });
    }

    const assessment = await createAssessmentRecord({
      profile: body.profile,
      lead: body.lead,
      responses: body.responses,
      result: body.result,
      uploadedAuditExtractions: body.uploadedAuditExtractions
    });
    const job = await createAnalysisJob(assessment);
    enqueueAnalysisJob(job.id);

    return NextResponse.json({
      jobId: job.id,
      assessmentId: assessment.id,
      status: job.status,
      currentStep: job.currentStep,
      progressPercent: job.progressPercent
    });
  } catch (error) {
    console.error("Analysis start failed", error);
    return NextResponse.json({ error: "Unable to start analysis job." }, { status: 500 });
  }
}
