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
      systemInstruction: "You are a helpful, creative, and clever assistant. You provide concise and accurate answers. Use markdown for formatting. If you write code, specify the language for syntax highlighting. If you write HTML, wrap it in ```html ... ``` blocks.",
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
