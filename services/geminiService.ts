
import { GoogleGenAI } from "@google/genai";
import { ParseResult } from "../types";

const SYSTEM_INSTRUCTION = `You are a world-class linguistic expert specializing in Generative Grammar and X-bar theory. 
Your task is to parse English sentences into formal X-bar syntax trees.

Output MUST be a single JSON object with this exact structure:
{
  "tree": {
    "label": "CP",
    "children": [
      { 
        "label": "C", 
        "word": "∅" 
      },
      { 
        "label": "InflP", 
        "children": [ ... ] 
      }
    ]
  },
  "explanation": "A brief linguistic analysis of the sentence structure.",
  "partsOfSpeech": [
    { "word": "word", "pos": "CATEGORY" }
  ]
}

Rules for X-bar labels:
1. Use standard labels: CP, InflP (Inflectional Phrase), DP, NP, VP, PP, AdjP, AdvP.
2. IMPORTANT: Use 'InflP' instead of 'TP'.
3. Follow X-bar schema: XP -> (Specifier) X'; X' -> X' (Adjunct) OR X' -> X (Head) (Complement).
4. Always label intermediate projections with a prime (e.g., N', V', Infl').
5. The leaf nodes should represent the actual words in the sentence.
6. CRITICAL: If a head (like C, Infl, or V) is null/silent, you MUST include the node with "word": "∅". Do not omit the head node. In most simple declarative sentences, the C head is null (∅).
7. Ensure the tree is deeply nested following proper formal syntax principles.`;

export const parseSentence = async (sentence: string): Promise<ParseResult> => {
  // Use the API key from process.env.
  const apiKey = (process.env as any).API_KEY;
  if (!apiKey) {
    throw new Error("Linguistic engine API key not found. Please ensure the environment is configured with process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the sentence: "${sentence}" using X-bar theory. Provide a deeply nested syntax tree. Ensure all silent heads like C or Infl are explicitly marked with the null symbol ∅.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("The linguistic model returned an empty response.");
    }
    
    try {
      return JSON.parse(text) as ParseResult;
    } catch (parseError) {
      console.error("JSON Parsing Error:", text);
      throw new Error("The model returned an invalid structure. Please try a different sentence.");
    }
  } catch (error: any) {
    console.error("Syntactic Parsing Error:", error);
    throw new Error(error.message || "An unexpected error occurred during syntactic analysis.");
  }
};
