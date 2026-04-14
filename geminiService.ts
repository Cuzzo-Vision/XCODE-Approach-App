
// Always use the exact import as defined in guidelines
import {GoogleGenAI} from "@google/genai";
import {GenerateContentResponse, Type} from "@google/genai";
import { GEMINI_MODEL } from "../constants";
import { IcebreakerResponse } from "../types";

export const generateIcebreaker = async (
  context: string,
  tone: string
): Promise<IcebreakerResponse> => {
  // Always use exact spacing as per guidelines
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  
  const prompt = `
    Situation/Observation: "${context}"
    Desired Tone: "${tone}"
    
    Task: Generate a conversation starter (opener), a brief piece of advice on delivery, and a confidence score (1-100).
  `;

  try {
    // Used systemInstruction and ai.models.generateContent with combined model and prompt
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a professional and charismatic social wingman. Your goal is to help users approach people with confidence. Generate a JSON response with an icebreaker 'opener', brief 'advice' on body language or delivery, and a 'confidenceScore' (1-100) based on the ease of the situation.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            opener: {
              type: Type.STRING,
              description: "The suggested opening line.",
            },
            advice: {
              type: Type.STRING,
              description: "Brief advice on delivery.",
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: "A score from 1-100 indicating ease of approach.",
            },
          },
          required: ["opener", "advice", "confidenceScore"],
        },
      },
    });

    // Directly access text property (not a method) as per guidelines
    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(text) as IcebreakerResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate icebreaker. Please try again.");
  }
};
