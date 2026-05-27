import { NextResponse } from "next/server";
import { extractAuditFieldsFromText } from "@/lib/nonprofit-viability/audit-document-service";
import { SourceDocument } from "@/lib/nonprofit-viability/types";
import { fiscalYearFromText } from "@/lib/nonprofit-viability/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sourceDocument = body.sourceDocument as SourceDocument | undefined;
    const text = String(body.text || "");

    if (!sourceDocument || !text.trim()) {
      return NextResponse.json({ error: "Source document and text are required." }, { status: 400 });
    }

    const extraction = await extractAuditFieldsFromText(text, sourceDocument, Number(body.fiscalYear) || fiscalYearFromText(text));
    return NextResponse.json({ extraction });
  } catch (error) {
    console.error("Financial extraction failed", error);
    return NextResponse.json({ error: "Unable to extract financial fields." }, { status: 500 });
  }
}
