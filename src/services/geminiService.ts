import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Message {
  role: "user" | "model";
  content: string;
  id: string;
  type?: "text" | "image";
  imageData?: string;
}

export async function* sendMessageStream(messages: Message[]) {
  const lastMessage = messages[messages.length - 1].content.toLowerCase();
  
  // Simple heuristic for image generation intent
  const isImageRequest = lastMessage.includes("generate image") || 
                         lastMessage.includes("create an image") || 
                         lastMessage.includes("draw a") ||
                         lastMessage.includes("show me a picture of");

  if (isImageRequest) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ parts: [{ text: messages[messages.length - 1].content }] }],
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          yield { type: "image", data: `data:image/png;base64,${part.inlineData.data}` };
        } else if (part.text) {
          yield { type: "text", data: part.text };
        }
      }
      return;
    } catch (error) {
      console.error("Image Generation Error:", error);
      yield { type: "text", data: "Error: Failed to generate image." };
      return;
    }
  }

  const model = "gemini-3-flash-preview";
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.content }]
  }));

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: "You are AM, a world-class AI assistant. You are an expert in all programming languages, mathematics, and complex problem-solving. \n\n" +
        "GUIDELINES:\n" +
        "1. Always provide accurate, step-by-step solutions for equations and logic problems.\n" +
        "2. Use **bold text** for important terms, file names, and key concepts to make them stand out.\n" +
        "3. Use markdown for all formatting. For code, always specify the language (e.g., ```python).\n" +
        "4. For HTML, wrap it in ```html blocks for previewing.\n" +
        "5. Be engaging! Use relevant emojis (stickers) at the beginning or end of your responses to add personality (e.g., 🚀, 💡, ✅, 🤖).\n" +
        "6. If a user says 'hi' or 'hello', respond with a friendly greeting and a welcoming emoji like 👋 or ✨.",
    },
    history: history,
  });

  try {
    const result = await chat.sendMessageStream({
      message: messages[messages.length - 1].content
    });

    for await (const chunk of result) {
      const response = chunk as GenerateContentResponse;
      yield { type: "text", data: response.text || "" };
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    yield { type: "text", data: "Error: Failed to connect to Gemini API." };
  }
}
