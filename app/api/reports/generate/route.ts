import { NextResponse } from "next/server";
import { reportGeneratorService } from "@/lib/nonprofit-viability/report-generator-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.organization || !body.viabilityScore) {
      return NextResponse.json({ error: "Organization and viability score are required." }, { status: 400 });
    }

    const report = await reportGeneratorService({
      organization: body.organization,
      sources: body.sources || [],
      financialYears: body.financialYears || [],
      viabilityScore: body.viabilityScore,
      websiteAnalysis: body.websiteAnalysis,
      registryResults: body.registryResults || [],
      publicRecords: body.publicRecords || []
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Viability report generation failed", error);
    return NextResponse.json({ error: "Unable to generate viability report." }, { status: 500 });
  }
}
