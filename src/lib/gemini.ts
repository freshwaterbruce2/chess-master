import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function getChessAdvice(fen: string, question: string = "What is the best move here and why?"): Promise<string> {
  if (!ai) {
    return "API Key not configured. Please set GEMINI_API_KEY in your environment.";
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert chess tutor. The current board state in FEN notation is: "${fen}".
      
User asks: "${question}"

Provide helpful, encouraging, and accurate chess advice. Give a brief evaluation of the position. If asked for a move, suggest a strong candidate and explain the reasoning behind it without being overly complicated. Keep it concise, friendly, and formatted nicely in Markdown.`,
    });
    return response.text || "I couldn't generate advice for this position.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while trying to analyze the position.";
  }
}
