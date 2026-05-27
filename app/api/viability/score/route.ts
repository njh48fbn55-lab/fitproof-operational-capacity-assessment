import { NextResponse } from "next/server";
import { viabilityScoringService } from "@/lib/nonprofit-viability/viability-scoring-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const viabilityScore = viabilityScoringService(body.financialYears || [], body.websiteAnalysis, body.registryResults || [], body.publicRecords || []);
    return NextResponse.json({ viabilityScore });
  } catch (error) {
    console.error("Viability scoring failed", error);
    return NextResponse.json({ error: "Unable to calculate viability score." }, { status: 500 });
  }
}
