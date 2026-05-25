import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json();

  console.log("Operational Capacity Assessment lead", {
    email: payload.lead?.email,
    organization: payload.profile?.organization,
    riskScore: payload.result?.riskScore,
    maturityScore: payload.result?.maturityScore,
    stage: payload.result?.stage?.number
  });

  return NextResponse.json({ ok: true });
}
