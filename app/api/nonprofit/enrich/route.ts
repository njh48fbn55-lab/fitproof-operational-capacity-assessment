import { NextResponse } from "next/server";
import { nonprofitEnrichmentService } from "@/lib/nonprofit-viability/enrichment-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await nonprofitEnrichmentService({
      name: body.name,
      ein: body.ein,
      state: body.state,
      website: body.website,
      includePublicRecordsSearch: body.includePublicRecordsSearch,
      includeStateRegistrySearch: body.includeStateRegistrySearch,
      uploadedDocumentIds: body.uploadedDocumentIds,
      uploadedAuditExtractions: body.uploadedAuditExtractions,
      assessmentResponses: body.assessmentResponses
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Nonprofit enrichment failed", error);
    return NextResponse.json({ error: "Unable to complete enhanced analysis." }, { status: 500 });
  }
}
