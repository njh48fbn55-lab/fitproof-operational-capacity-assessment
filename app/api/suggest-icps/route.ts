import { NextRequest, NextResponse } from "next/server";
import { suggestIcpHypotheses } from "@/lib/icp-suggestions";
import { emptyAssessment } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const assessment = { ...emptyAssessment, ...payload };

    if (!assessment.productDescription.trim() && !assessment.problemSolved.trim() && !assessment.marketCategory.trim()) {
      return NextResponse.json(
        { error: "Add a product description, problem solved, or market category before suggesting ICPs." },
        { status: 400 }
      );
    }

    return NextResponse.json({ suggestions: suggestIcpHypotheses(assessment) });
  } catch {
    return NextResponse.json(
      { error: "ICP suggestion failed. Try again with a clearer product description or problem statement." },
      { status: 500 }
    );
  }
}
