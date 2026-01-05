import { GoogleGenAI, Type } from "@google/genai";
import { ParseResult } from "../types";

const SYSTEM_INSTRUCTION = `You are a world-class linguistic expert specializing in Generative Grammar and X-bar theory. 
Your task is to parse English sentences into formal X-bar syntax trees.

Output MUST be a single JSON object.

Rules for X-bar labels:
1. Use standard labels: CP, InflP (Inflectional Phrase), DP, NP, VP, PP, AdjP, AdvP.
2. IMPORTANT: Use 'InflP' instead of 'TP'.
3. Follow X-bar schema: XP -> (Specifier) X'; X' -> X' (Adjunct) OR X' -> X (Head) (Complement).
4. Always label intermediate projections with a prime (e.g., N', V', Infl').
5. The leaf nodes should represent the actual words in the sentence.
6. CRITICAL: If a head (like C, Infl, or V) is null/silent, you MUST include the node with "word": "∅". Do not omit the head node. In most simple declarative sentences, the C head is null (∅).
7. Ensure the tree is deeply nested following proper formal syntax principles.`;

// Service function to parse sentence structure using X-bar theory
export const parseSentence = async (sentence: string): Promise<ParseResult> => {
  // Obtain the API key exclusively from the environment variable process.env.API_KEY.
  if (!process.env.API_KEY) {
    throw new Error(
      "Arbor Connection Failed: No API Key detected. " +
      "Please ensure the environment is configured with a valid API_KEY."
    );
  }

  // Create a new instance right before making an API call to ensure the latest key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the sentence: "${sentence}" using X-bar theory. Provide a deeply nested syntax tree. Ensure all silent heads like C or Infl are explicitly marked with the null symbol ∅.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Using responseSchema for the expected JSON output as per best practices.
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tree: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                children: { 
                  type: Type.ARRAY, 
                  items: { type: Type.OBJECT } 
                },
                word: { type: Type.STRING }
              },
              required: ["label"]
            },
            explanation: { type: Type.STRING },
            partsOfSpeech: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  pos: { type: Type.STRING }
                },
                required: ["word", "pos"]
              }
            }
          },
          required: ["tree", "explanation", "partsOfSpeech"]
        },
        temperature: 0,
      }
    });

    // Extracting text output directly from GenerateContentResponse property.
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
    
    // Check for common API key errors or project issues
    if (error.message?.includes("API key not valid") || error.message?.includes("Requested entity was not found")) {
      throw new Error("Authentication failed. Please ensure the API key is valid and linked to a paid project.");
    }
    
    throw new Error(error.message || "An unexpected error occurred during syntactic analysis.");
  }
};