import { NextResponse } from "next/server";
import { extractAuditFieldsFromText, saveUploadedAuditDocument } from "@/lib/nonprofit-viability/audit-document-service";
import { fiscalYearFromText, roughTextFromBytes, writeJsonRecord } from "@/lib/nonprofit-viability/utils";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const organizationName = String(formData.get("organizationName") || "organization");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No document was uploaded." }, { status: 400 });
    }

    const saved = await saveUploadedAuditDocument(file, organizationName);
    const roughText = roughTextFromBytes(saved.bytes);
    const fiscalYear = fiscalYearFromText(roughText);
    const extraction = await extractAuditFieldsFromText(roughText, saved.sourceDocument, fiscalYear);

    await writeJsonRecord("source-documents", `${saved.sourceDocument.id}.json`, saved.sourceDocument).catch(() => undefined);
    await writeJsonRecord("audit-extractions", `${saved.sourceDocument.id}.json`, extraction).catch(() => undefined);

    return NextResponse.json({
      sourceDocument: saved.sourceDocument,
      extraction,
      note: "Document saved. Text extraction is conservative; unavailable financial fields remain null."
    });
  } catch (error) {
    console.error("Document upload failed", error);
    return NextResponse.json({ error: "Unable to upload or read this document." }, { status: 500 });
  }
}
