
import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { PromptBuilder } from "@/services/promptBuilder";
import { ShoppingKitGenerator } from "@/services/shoppingKitGenerator";

function cleanJsonText(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  cleaned = cleaned.trim();

  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");

  if (startIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  const requestStart = Date.now();

  try {
    const { messages, context = {} } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Conversation history messages are required." },
        { status: 400 }
      );
    }

    const products = (context.products || []).filter(
      (p: any) =>
        p.approvalStatus === "approved" &&
        p.availability !== "out_of_stock" &&
        p.quantity > 0
    );

    const inventoryList = products.map((p: any) => ({
      productName: p.productName,
      category: p.category,
      price: p.price,
    }));

    const systemPrompt = PromptBuilder.buildPrompt({
      preferredLanguage: context.preferredLanguage || "en",
      role: context.role || "customer",
      city: context.city || "Chennai",
      weather: context.weather,
      latestCropAnalysis: context.latestCropAnalysis,
      latestTerraceAnalysis: context.latestTerraceAnalysis,
      marketplaceInventory: inventoryList,
    });

    const firstUserIdx = messages.findIndex(
      (m: any) => m.role === "user"
    );

    const activeMessages =
      firstUserIdx !== -1 ? messages.slice(firstUserIdx) : messages;

    const contents = activeMessages.map((m: any) => ({
      role:
        m.role === "assistant" || m.role === "model"
          ? "model"
          : "user",
      parts: [{ text: m.content }],
    }));

    const geminiStart = Date.now();
    const maxAttempts = 3;
    let response: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
          },
        });

        break;
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : String(error);

        const temporaryError =
          /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED|500|INTERNAL|502|504/i.test(
            message
          );

        console.error(
          `[Shopping Assistant] Gemini attempt ${attempt} failed:`,
          message
        );

        if (!temporaryError || attempt === maxAttempts) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1500)
        );
      }
    }

    console.log(
      `[Shopping Assistant] Gemini response time: ${
        Date.now() - geminiStart
      } ms`
    );

    const text = response?.text ?? "";
    const cleanedJson = cleanJsonText(text);

    let parsedResult: any;

    try {
      parsedResult = JSON.parse(cleanedJson);
    } catch (error) {
      console.error("[Shopping Assistant] JSON parsing failed:", error);

      return NextResponse.json({
        reply:
          text ||
          "Sorry, I couldn't format the response. Please try again.",
        shoppingKit: null,
      });
    }

    let shoppingKit = null;

    if (Array.isArray(parsedResult.conceptualShoppingKit?.items)) {
      try {
        shoppingKit = ShoppingKitGenerator.generateKit(
          parsedResult.conceptualShoppingKit,
          products
        );
      } catch (error) {
        console.error(
          "[Shopping Assistant] Product matching failed:",
          error
        );
      }
    }

    console.log(
      `[Shopping Assistant] Total request time: ${
        Date.now() - requestStart
      } ms`
    );

    return NextResponse.json({
      reply: parsedResult.reply || "How can I help you today?",
      shoppingKit,
    });
  } catch (error: any) {
    console.error("[Shopping Assistant] Request failed:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    const status =
      /503|UNAVAILABLE|high demand|overloaded/i.test(message)
        ? 503
        : /429|RESOURCE_EXHAUSTED/i.test(message)
          ? 429
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
