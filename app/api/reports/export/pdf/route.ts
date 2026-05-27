import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { html, fileName } = (await request.json().catch(() => ({}))) as { html?: string; fileName?: string };
  if (!html) {
    return NextResponse.json({ error: "Report HTML was not provided." }, { status: 400 });
  }

  try {
    const playwright = await importOptional("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.35in", bottom: "0.45in", left: "0.35in" }
    });
    await browser.close();

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(fileName || "fitproof-operational-capacity-report.pdf")}"`
      }
    });
  } catch (error) {
    console.error("PDF export failed", error);
    return NextResponse.json(
      {
        error: "Branded PDF export is temporarily unavailable on this server. Please use Download Branded Word Document as a fallback."
      },
      { status: 503 }
    );
  }
}

async function importOptional(packageName: string) {
  return (await (0, eval)(`import(${JSON.stringify(packageName)})`)) as any;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9_.-]+/gi, "-").replace(/^-+|-+$/g, "") || "fitproof-operational-capacity-report.pdf";
}
