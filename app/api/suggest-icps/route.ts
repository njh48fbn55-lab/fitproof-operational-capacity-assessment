import { NextRequest, NextResponse } from "next/server";
import { IcpSuggestion, suggestIcpHypotheses } from "@/lib/icp-suggestions";
import { AssessmentInput, emptyAssessment } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const icpSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "segment",
          "verticals",
          "excludedVerticals",
          "description",
          "economicBuyer",
          "endUser",
          "buyingTrigger",
          "reasoning",
          "painIntensityReasoning",
          "budgetReasoning",
          "urgencyReasoning",
          "reachabilityReasoning",
          "currentAlternatives",
          "whyItFits",
          "whyNotOthers",
          "validationQuestions",
          "validationQuestion",
          "recommendedDiscoveryMotion",
          "confidence"
        ],
        properties: {
          id: { type: "string" },
          segment: { type: "string" },
          verticals: { type: "array", items: { type: "string" } },
          excludedVerticals: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          economicBuyer: { type: "string" },
          endUser: { type: "string" },
          buyingTrigger: { type: "string" },
          reasoning: { type: "string" },
          painIntensityReasoning: { type: "string" },
          budgetReasoning: { type: "string" },
          urgencyReasoning: { type: "string" },
          reachabilityReasoning: { type: "string" },
          currentAlternatives: { type: "array", items: { type: "string" } },
          whyItFits: { type: "string" },
          whyNotOthers: { type: "string" },
          validationQuestions: { type: "array", items: { type: "string" } },
          validationQuestion: { type: "string" },
          recommendedDiscoveryMotion: { type: "string" },
          confidence: { type: "string", enum: ["High", "Medium", "Exploratory"] }
        }
      }
    }
  }
};

function extractOutputText(response: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (response.output_text) return response.output_text;

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }

  return "";
}

function makeSystemPrompt() {
  return [
    "You are a market readiness analyst for pre-seed and seed-stage B2B startups.",
    "Generate specific ICP hypotheses based only on the provided founder inputs.",
    "Do not claim product-market fit.",
    "Prefer concrete verticals, buyer roles, end users, pain frequency, budget logic, urgency, current alternatives, and reachability.",
    "Include excluded verticals or customer types that look tempting but are likely poor early ICPs.",
    "Be opinionated. Avoid generic language like 'businesses of all sizes' or 'companies looking to improve efficiency'.",
    "Each ICP should be different enough to test in discovery.",
    "Return structured JSON only."
  ].join(" ");
}

function makeUserPrompt(assessment: AssessmentInput) {
  return JSON.stringify(
    {
      task: "Create 4 high-quality ICP hypotheses for a Market Readiness assessment.",
      assessment,
      outputGuidance: {
        verticals: "Name 3-5 specific verticals or market slices per ICP.",
        excludedVerticals: "Name verticals or segments to avoid early and why they are likely weak.",
        reasoning: "Explain why this ICP has stronger pain, budget, urgency, and reachability than broader alternatives.",
        validationQuestions: "Write sharp discovery questions that could validate or kill the ICP.",
        recommendedDiscoveryMotion: "Suggest the first concrete discovery motion for this ICP."
      }
    },
    null,
    2
  );
}

async function generateWithOpenAI(assessment: AssessmentInput): Promise<IcpSuggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return suggestIcpHypotheses(assessment);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: makeSystemPrompt() },
        { role: "user", content: makeUserPrompt(assessment) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fitproof_icp_suggestions",
          strict: true,
          schema: icpSchema
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI ICP analysis failed.");
  }

  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("OpenAI returned an empty ICP analysis.");

  const parsed = JSON.parse(outputText) as { suggestions: IcpSuggestion[] };
  return parsed.suggestions.map((suggestion, index) => ({
    ...suggestion,
    id: suggestion.id || `llm-icp-${index + 1}`,
    validationQuestion: suggestion.validationQuestion || suggestion.validationQuestions[0] || "What evidence would validate this ICP?"
  }));
}

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

    const source = process.env.OPENAI_API_KEY ? "openai" : "local-fallback";
    const notice =
      source === "local-fallback"
        ? "OPENAI_API_KEY is not configured, so FitProof used the local fallback ICP generator."
        : undefined;

    return NextResponse.json({ suggestions: await generateWithOpenAI(assessment), source, notice });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ICP suggestion failed. Try again with a clearer product description or problem statement."
      },
      { status: 500 }
    );
  }
}
