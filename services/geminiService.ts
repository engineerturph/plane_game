
import { GoogleGenAI, Type } from "@google/genai";
import { MissionInfo } from "../types";

const apiKey = process.env.API_KEY ?? process.env.GEMINI_API_KEY;
const safeClient = (() => {
  if (!apiKey || apiKey === "undefined" || apiKey === "null") {
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    return null;
  }
})();

export async function generateMissionBriefing(): Promise<MissionInfo> {
  try {
    if (!safeClient) {
      throw new Error("Missing API key");
    }
    const response = await safeClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a futuristic flight trial mission name, a cool pilot callsign, and a short one-sentence objective about hunting down and neutralizing a single elite enemy pilot in a dense asteroid field.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            objective: { type: Type.STRING },
            pilotCallsign: { type: Type.STRING }
          },
          required: ["name", "objective", "pilotCallsign"]
        }
      }
    });

    // FIX: Add check for response.text and trim before parsing to prevent runtime errors.
    const text = response.text;
    if (!text) {
      throw new Error("API returned an empty response.");
    }
    const data = JSON.parse(text.trim());
    return data;
  } catch (error) {
    // Silently fallback on quota errors or other API issues
    return {
      name: "Operation Viper Hunt",
      objective: "An elite enemy pilot has been detected. Hunt them down and neutralize the threat.",
      pilotCallsign: "Hunter-1"
    };
  }
}

export async function generateGameOverTaunt(score: number): Promise<string> {
  try {
    if (!safeClient) {
      throw new Error("Missing API key");
    }
    const response = await safeClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short pilot debriefing comment for a pilot who scored ${score} points before crashing. Make it professional yet slightly critical if the score is low. Keep it under 15 words.`,
    });
    // FIX: Add check for response.text to prevent runtime errors.
    const text = response.text;
    if (!text) {
      throw new Error("API returned an empty response.");
    }
    return text.trim();
  } catch (error) {
    return score > 50 ? "Exceptional flying, pilot. The swarm is thinning." : "Simulation terminated. Check your vectors and try again.";
  }
}

export async function generateWinMessage(score: number): Promise<string> {
  try {
    if (!safeClient) {
      throw new Error("Missing API key");
    }
    const response = await safeClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, celebratory pilot debriefing comment for a pilot who successfully eliminated the primary target and scored ${score} points. Keep it under 15 words.`,
    });
    // FIX: Add check for response.text to prevent runtime errors.
    const text = response.text;
    if (!text) {
      throw new Error("API returned an empty response.");
    }
    return text.trim();
  } catch (error) {
    return "Target neutralized. Excellent work, pilot. Return to base.";
  }
}
