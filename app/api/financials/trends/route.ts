import { NextResponse } from "next/server";
import { financialTrendService } from "@/lib/nonprofit-viability/financial-trend-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const financialYears = financialTrendService(body.form990Years || [], body.auditExtractions || []);
    return NextResponse.json({ financialYears });
  } catch (error) {
    console.error("Financial trend calculation failed", error);
    return NextResponse.json({ error: "Unable to calculate financial trends." }, { status: 500 });
  }
}
