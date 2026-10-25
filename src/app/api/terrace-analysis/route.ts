import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

function cleanJsonText(text: string): string {
  let cleaned = text.trim();

  // Remove markdown formatting
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Extract exactly the JSON object boundaries
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { image, manualDetails, mode } = await req.json();

    const analysisMode = mode || "image";

    // Retrieve user language preference from cookie
    const preferredLanguage = req.cookies.get("preferredLanguage")?.value || "en";

    let languageInstruction = "";
    if (preferredLanguage === "ta") {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in Tamil (தமிழ்).
- Keep all JSON keys in English exactly as defined in the schema (do NOT translate terraceArea, usableArea, layout, etc.). Only translate the text values of these keys.
`;
    } else if (preferredLanguage === "hi") {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in Hindi (हिन्दी).
- Keep all JSON keys in English exactly as defined in the schema (do NOT translate terraceArea, usableArea, layout, etc.). Only translate the text values of these keys.
`;
    } else {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in English.
`;
    }

    let modeInstruction = "";
    if (analysisMode === "manual") {
      modeInstruction = `
ANALYSIS MODE: MANUAL PLANNING
You do NOT have an image.
You must use the following manual details provided by the user to plan their terrace farming layout:
- Terrace Length: ${manualDetails?.length || "Unknown"} ft
- Terrace Width: ${manualDetails?.width || "Unknown"} ft
- Building Floor: ${manualDetails?.floor || "Unknown"}
- City: ${manualDetails?.city || "Unknown"}
- Budget: ${manualDetails?.budget || "Unknown"}
- Farming Preference: ${manualDetails?.preference || "Mixed"}

Provide custom, realistic plans tailored to these inputs.
- Total Area MUST be calculated EXACTLY as ${manualDetails?.length || 0} * ${manualDetails?.width || 0} = ${(Number(manualDetails?.length || 0) * Number(manualDetails?.width || 0))} sq ft.
`;
    } else if (analysisMode === "hybrid") {
      modeInstruction = `
ANALYSIS MODE: HYBRID ANALYSIS (IMAGE + MANUAL DETAILS)
You have both an uploaded image and manual terrace details.
Manual Terrace Details:
- Terrace Length: ${manualDetails?.length || "Unknown"} ft
- Terrace Width: ${manualDetails?.width || "Unknown"} ft
- Building Floor: ${manualDetails?.floor || "Unknown"}
- City: ${manualDetails?.city || "Unknown"}
- Budget: ${manualDetails?.budget || "Unknown"}
- Farming Preference: ${manualDetails?.preference || "Mixed"}

Cross-validate both the image and the manual inputs.
IMPORTANT RULE: Manual dimensions (Length & Width) take absolute priority over image-based estimates. Calculate the terrace area exactly using length * width:
- Total Area MUST be calculated EXACTLY as ${manualDetails?.length || 0} * ${manualDetails?.width || 0} = ${(Number(manualDetails?.length || 0) * Number(manualDetails?.width || 0))} sq ft.
- Correlate visual obstructions, structural features, and shading in the image with the manual preference/budget limits.
`;
    } else {
      modeInstruction = `
ANALYSIS MODE: IMAGE ANALYSIS
You have only an uploaded image.
Estimate terrace dimensions, area, sunlight, and drainage entirely from the visual cues in the image.
`;
    }

    const prompt = `
You are an Urban Terrace Farming Expert and AI Planner.
Analyze the user's terrace inputs based on the selected mode and return ONLY valid JSON.

Return this exact format:

{
  "analysisMode": "",
  "terraceArea": "",
  "usableArea": "",
  "sunlight": "",
  "drainage": "",
  "layout": "",
  "recommendedCrops": [],
  "growBagCount": "",
  "hydroponicsSuitability": "",
  "waterTankPlacement": "",
  "estimatedCost": "",
  "shoppingRecommendations": [],
  "maintenanceTips": [],
  "analysisSummary": "",
  "confidence": "",
  "confidenceReason": []
}

Rules:
- In analysisMode, specify which mode was used: "Image Analysis", "Manual Planning", or "Hybrid Analysis".
- In recommendedCrops, shoppingRecommendations, maintenanceTips, and confidenceReason, return arrays of strings.
- In estimatedCost, specify the estimated plan setup cost (e.g. "12,500 INR" or translated).
- In growBagCount, estimate the number of grow bags matching the terrace dimensions and usable area (e.g. "15 Bags").
- In waterTankPlacement, suggest the best corner/spot for water tank safety load distributions (e.g. "South-West corner above columns").
- In hydroponicsSuitability, provide a short text assessing the suitability for hydroponics setups.
- In terraceArea, calculate the total area. For manual and hybrid modes, calculate EXACTLY as Length * Width (e.g., if length is 20 ft and width is 15 ft, area must be 300 sq ft). For image mode, estimate from visual cues.
- In usableArea, estimate the remaining area suitable for crop installations (typically 70-80% of total area).
- No markdown formatting.
- No explanation.
- JSON only.

${modeInstruction}

${languageInstruction}
`;

    const parts: any[] = [
      {
        text: prompt,
      },
    ];

    if (image && (analysisMode === "image" || analysisMode === "hybrid")) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
    });

    const text = response.text ?? "";
    const cleanedJson = cleanJsonText(text);

    return NextResponse.json({
      result: cleanedJson,
    });
  } catch (error) {
    console.error("Gemini terrace analysis failed:", error);
    return NextResponse.json(
      { error: "Gemini analysis failed." },
      { status: 500 }
    );
  }
}
