import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI SDK
// It automatically picks up GEMINI_API_KEY from the environment
const ai = new GoogleGenAI({});

export interface CopilotInputs {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  fundamentals: any;
  nexusScore: number;
  factorScores: any;
  notes: any[];
}

export interface CopilotMemo {
  thesis: string;
  bullCase: string;
  bearCase: string;
  risks: string[];
}

export async function generateAiMemo(inputs: CopilotInputs): Promise<CopilotMemo | null> {
  try {
    const prompt = `
      You are an expert institutional equity research analyst. Your task is to synthesize the provided data into a concise, professional investment memo for ${inputs.ticker} (${inputs.name}), operating in the ${inputs.sector} sector.

      Current Price: ${inputs.price}
      Nexus Alpha Score: ${inputs.nexusScore}/100
      Factor Breakdown: ${JSON.stringify(inputs.factorScores)}
      
      Recent Fundamentals:
      ${JSON.stringify(inputs.fundamentals, null, 2)}
      
      Analyst Notes/Context:
      ${JSON.stringify(inputs.notes.map((n: any) => ({ tag: n.tag, note: n.body })), null, 2)}

      Based ONLY on the provided data, generate a structured JSON response with the following keys exactly:
      - "thesis": A 2-3 sentence overarching investment thesis.
      - "bullCase": A 2-3 sentence bull case scenario.
      - "bearCase": A 2-3 sentence bear case scenario.
      - "risks": An array of 3-4 specific, concise risk factors (strings).

      Do not use markdown formatting like \`\`\`json. Return pure JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) return null;

    const parsed = JSON.parse(response.text);
    return {
      thesis: parsed.thesis || "No thesis provided.",
      bullCase: parsed.bullCase || "No bull case provided.",
      bearCase: parsed.bearCase || "No bear case provided.",
      risks: Array.isArray(parsed.risks) ? parsed.risks : ["No risks provided."]
    };
  } catch (error) {
    console.error("Error generating AI memo:", error);
    return null;
  }
}
