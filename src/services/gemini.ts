import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function suggestHabits(goals: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on these goals: "${goals}", suggest 3-5 daily habits. Return them as a JSON array of objects with "name", "icon" (lucide icon name), and "color" (hex).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            icon: { type: Type.STRING },
            color: { type: Type.STRING },
          },
          required: ["name", "icon", "color"],
        },
      },
    },
  });
  return JSON.parse(response.text || "[]");
}

export async function getMotivation(habitName: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Give me a short, punchy, Apple-style motivational quote for someone tracking their "${habitName}" habit. Keep it under 15 words.`,
  });
  return response.text;
}

export async function editProofImage(base64Image: string, prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1],
            mimeType: "image/png",
          },
        },
        { text: prompt },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
