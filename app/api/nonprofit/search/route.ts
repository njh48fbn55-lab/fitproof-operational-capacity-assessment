import { NextResponse } from "next/server";
import { nonprofitSearchService } from "@/lib/nonprofit-viability/nonprofit-search-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organization = await nonprofitSearchService({
      name: body.name,
      ein: body.ein,
      state: body.state,
      website: body.website
    });

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Nonprofit search failed", error);
    return NextResponse.json({ error: "Unable to search nonprofit records." }, { status: 500 });
  }
}
