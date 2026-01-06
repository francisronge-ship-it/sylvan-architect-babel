import { GoogleGenAI } from "@google/genai";
import { ParseResult } from "../types";

const SYSTEM_INSTRUCTION = `You are a world-class linguistic expert specializing in Generative Grammar and X-bar theory. 
Your task is to parse English sentences into formal X-bar syntax trees.

Output MUST be a single, valid JSON object.

Rules for X-bar labels:
1. Use standard labels: CP, InflP, DP, NP, VP, PP, AdjP, AdvP.
2. IMPORTANT: Use 'InflP' instead of 'TP'.
3. Follow X-bar schema: XP -> (Specifier) X'; X' -> X' (Adjunct) OR X' -> X (Head) (Complement).
4. Always label intermediate projections with a prime (e.g., N', V', Infl').
5. Leaf nodes represent the actual words.
6. CRITICAL: Mark null/silent heads (C, Infl, V) with the symbol ∅.
7. Ensure the tree is deeply nested following proper formal syntax principles.

The JSON structure must be:
{
  "tree": {
    "label": "CP",
    "children": [
      {
        "label": "C'",
        "children": [
          { "label": "C", "word": "∅" },
          { "label": "InflP", "children": [...] }
        ]
      }
    ]
  },
  "explanation": "A concise linguistic derivation note.",
  "partsOfSpeech": [ {"word": "example", "pos": "N"}, ... ]
}`;

export const parseSentence = async (sentence: string): Promise<ParseResult> => {
  // Always fetch the latest key from the environment as it might be updated via a dialog
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  // Create a new instance right before making an API call to ensure 
  // it uses the most up-to-date API key (especially after selection).
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Pro model required for complex linguistic reasoning
      contents: `Analyze the sentence: "${sentence}" and return a complete X-bar theory syntax tree in the specified JSON format.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
        // gemini-3-pro-preview REQUIRES a non-zero thinkingBudget
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty model response.");
    }
    
    try {
      const parsed = JSON.parse(text);
      if (!parsed.tree || !parsed.explanation) {
        throw new Error("Malformed structural components.");
      }
      return parsed as ParseResult;
    } catch (parseErr) {
      console.error("JSON Parse Error:", text);
      throw new Error("Linguistic result malformed. Please try again.");
    }
  } catch (error: any) {
    console.error("Syntactic Parsing Error:", error);
    
    const msg = error.message || "";
    const errorDetails = JSON.stringify(error);
    
    // Specifically catch expired or invalid keys to trigger the re-auth UI
    if (
      msg.includes("API key expired") || 
      msg.includes("API_KEY_INVALID") || 
      errorDetails.includes("API_KEY_INVALID") ||
      msg.includes("400") || 
      msg.includes("INVALID_ARGUMENT") && !msg.includes("Budget")
    ) {
      throw new Error("API_KEY_EXPIRED");
    }
    
    if (msg.includes("403") || msg.includes("not found")) {
      throw new Error("API_KEY_INVALID");
    }
    
    throw new Error(msg || "Syntactic parsing failed. Check connection.");
  }
};