import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/app/lib/openai";
import { getBusiness, upsertBusiness, Business } from "@/app/lib/store";

// Extract plain text from an uploaded file. Supports PDF (parsed) and
// text-based formats (.txt/.md/.csv) read directly.
async function extractText(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");

  if (isPdf) {
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  }

  // Fallback: treat as UTF-8 text (.txt, .md, .csv, etc.)
  return (await file.text()).trim();
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const businessId = formData.get("businessId") as string;
  const businessName = formData.get("businessName") as string;

  if (!file || !businessId || !businessName) {
    return NextResponse.json({ error: "Missing file, businessId, or businessName" }, { status: 400 });
  }

  let fileContent: string;
  try {
    fileContent = await extractText(file);
  } catch (err) {
    console.error("File parse failed:", err);
    return NextResponse.json(
      { error: "Could not read that file. Upload a PDF or a .txt/.md file." },
      { status: 400 }
    );
  }

  if (!fileContent) {
    return NextResponse.json(
      { error: "The file appears to be empty or unreadable (scanned/image-only PDFs aren't supported)." },
      { status: 400 }
    );
  }

  // AI reads the file and determines if it needs more info
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an AI agent onboarding a restaurant business. You've just received a knowledge file about the business. Read it carefully and determine if you have enough information to fully represent this restaurant in negotiations.

You need to understand: cuisine type, specific dishes with prices, ingredients, sourcing practices, values, location, ambiance, unique differentiators, and target customers.

If the file covers all these areas comprehensively, respond with:
[READY]
Followed by a summary of what you know.

If the file is missing critical information, respond with a specific follow-up question about what's missing. Ask ONE question at a time.`,
      },
      { role: "user", content: `Here is the knowledge file for "${businessName}":\n\n${fileContent}` },
    ],
  });

  const reply = response.choices[0].message.content || "";
  const isReady = reply.includes("[READY]");

  let business: Business = getBusiness(businessId) || {
    id: businessId,
    name: businessName,
    knowledge: "",
    isReady: false,
    conversationHistory: [],
  };

  business.name = businessName;
  business.conversationHistory.push({ role: "user", content: `[Uploaded knowledge file]\n\n${fileContent}` });
  business.conversationHistory.push({ role: "assistant", content: reply });

  if (isReady) {
    business.isReady = true;
    business.knowledge = reply.replace("[READY]", "").trim();
  }

  upsertBusiness(business);

  return NextResponse.json({ reply, isReady });
}
