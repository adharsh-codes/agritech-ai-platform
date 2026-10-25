import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { fetchWeather } from "@/services/weatherService";

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
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: "Image is required." },
        { status: 400 }
      );
    }

    // Retrieve user language preference from cookie
    const preferredLanguage = req.cookies.get("preferredLanguage")?.value || "en";

    let languageInstruction = "";
    if (preferredLanguage === "ta") {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in Tamil (தமிழ்).
- Keep all JSON keys in English exactly as defined in the schema (do NOT translate crop, health, disease, etc.). Only translate the text values of these keys.
`;
    } else if (preferredLanguage === "hi") {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in Hindi (हिन्दी).
- Keep all JSON keys in English exactly as defined in the schema (do NOT translate crop, health, disease, etc.). Only translate the text values of these keys.
`;
    } else {
      languageInstruction = `
IMPORTANT LANGUAGE RULE:
- You must generate all text responses and string values in English.
`;
    }

    // Fetch live weather context
    let weatherContext = "";
    try {
      const weather = await fetchWeather();
      weatherContext = `
Current Weather Context of the crop location:
- Location: ${weather.location}
- Temperature: ${weather.temperature}°C
- Humidity: ${weather.humidity}%
- Rain Probability: ${weather.rainProbability}%
- Wind Speed: ${weather.windSpeed} km/h
- Current Condition: ${weather.condition}

RULES FOR WEATHER-AWARE RECOMMENDATIONS:
- Tailor water, fertilizer, and general diagnostic suggestions based on this weather context.
- For example, if rain probability is high (e.g. above 50% or current condition is rainy), strongly suggest reducing or pausing irrigation.
- If the temperature is very high or conditions are very dry, recommend protective watering.
- If humidity is high and there is a fungal disease, warn about poor air circulation.
`;
    } catch (weatherErr) {
      console.error("Failed to load weather context for Gemini prompt:", weatherErr);
    }

    const prompt = `
You are an agricultural AI expert and plant health advisor.
Analyze this crop image and return ONLY valid JSON.

Return this exact format:

{
  "crop": "",
  "health": "",
  "disease": "",
  "severity": "",
  "cause": "",
  "whyOccurs": "",
  "symptoms": [],
  "treatment": [],
  "prevention": [],
  "water": "",
  "fertilizer": "",
  "recoveryTime": "",
  "recommendation": "",
  "confidence": "",
  "confidenceReason": [],
  "analysisSummary": "",
  "imageQuality": "",
  "analysisLimitations": ""
}

Rules:
- Estimate overall health and specify if any disease is visible.
- If no disease is detected, output "No visible disease" for disease and "None" for severity.
- In cause, explain what pathogen, fungus, bacteria, virus, insect, or deficiency caused the disease.
- In whyOccurs, explain why the disease develops (e.g., poor ventilation, humidity, overwatering, deficient nutrients).
- In symptoms, return an array of strings outlining leaf/stem visual symptoms.
- In treatment, return an array of strings detailing step-by-step remedial treatments (organic or chemical).
- In prevention, return an array of strings detailing preventative actions.
- In recoveryTime, estimate the recovery period (e.g. "7-14 days").
- In confidenceReason, provide an array of strings explaining why the confidence score is high or low (e.g. image quality, leaf visibility, camera focus, lighting).
- In imageQuality, assess the uploaded image quality (e.g. "Good", "Fair", "Poor").
- In analysisLimitations, list any limitations of the visual analysis (e.g. "Blurry image", "Leaf partially covered", or "No major limitations detected").
- In analysisSummary, write a short paragraph summarizing the diagnosis.
- No markdown formatting.
- No explanation.
- JSON only.

${languageInstruction}

${weatherContext}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: image,
              },
            },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const cleanedJson = cleanJsonText(text);

    return NextResponse.json({
      result: cleanedJson,
    });
  } catch (error) {
    console.error("Gemini crop analysis failed:", error);
    return NextResponse.json(
      {
        error: "Gemini analysis failed.",
      },
      {
        status: 500,
      }
    );
  }
}